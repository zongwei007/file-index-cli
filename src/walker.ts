import {
  basename,
  join,
  normalize,
} from "https://deno.land/std@0.89.0/path/mod.ts";
import { readLines } from "https://deno.land/std@0.89.0/io/mod.ts";

import { File } from "./model/mod.ts";

const LINE_MATCHER = /^(\S+) (\d+) (\S+) (\S+)\s+(\d+) (\d+) ([\S\s]+)$/;

interface WalkEntry extends Deno.DirEntry {
  path: string;
}

export interface Walker {
  root: string;
  path: string;

  walk: (filter: (entry: WalkEntry) => boolean) => AsyncIterableIterator<File>;
}

export function createWalker(root: string): Walker {
  if (root.includes(":") && root.includes("@")) {
    return new CommanderWalker(root);
  } else {
    return new LocalWalker(root);
  }
}

class CommanderWalker implements Walker {
  host: string;
  path: string;
  root: string;
  user: string;

  constructor(source: string) {
    this.user = source.substring(0, source.indexOf("@"));
    this.host = source.substring(this.user.length + 1, source.indexOf(":"));
    this.path = source.substring(source.indexOf(":") + 1);
    this.root = this.host + ":" + this.path;
  }

  async *walk(
    filter: (entry: WalkEntry) => boolean
  ): AsyncIterableIterator<File> {
    const command = `ssh ${this.user}@${this.host} sudo ls -R -l --time-style +%s ${this.path} > .swap.tmp`;

    console.log("Execute command：%s", command);

    const p = Deno.run({
      cmd: ["cmd", "/C", command],
      stderr: "piped",
    });

    const [status, stderr] = await Promise.all([p.status(), p.stderrOutput()]);

    p.close();

    if (status.success) {
      const fileReader = await Deno.open("./.swap.tmp");

      let folderPath = this.path;
      const ignoreFolders: string[] = [];

      for await (const line of readLines(fileReader)) {
        if (line.startsWith(this.path) && line.endsWith(":")) {
          folderPath = line.substring(0, line.length - 1);
          continue;
        } else if (line.startsWith("total ")) {
          continue;
        }

        const groups = LINE_MATCHER.exec(line);

        if (!groups) {
          continue;
        }

        const entry = {
          name: groups[7],
          path: `${folderPath}/${groups[7]}`,
          isFile: groups[1].charAt(0) === "-",
          isDirectory: groups[1].charAt(0) === "d",
          isSymlink: groups[1].charAt(0) === "l",
        };

        if (ignoreFolders.some((path) => entry.path.startsWith(path))) {
          continue;
        }

        if (entry.isDirectory) {
          // 写入目录忽略信息
          if (!filter(entry)) {
            ignoreFolders.push(entry.path);
          }

          //仅读取文件，目录等待后续处理
          continue;
        }

        if (filter(entry)) {
          const file = new File();
          file.size = parseInt(groups[5]);
          file.lastModified = parseInt(groups[6]);
          file.name = entry.name;
          file.path = entry.path;

          yield file;
        }
      }
    } else {
      const message = new TextDecoder().decode(stderr);
      console.error("execute fail", status.code, message);

      throw Error(message);
    }

    await Deno.remove(".swap.tmp");
  }
}

class LocalWalker implements Walker {
  path: string;
  root: string;

  constructor(root: string) {
    this.path = this.root = Deno.realPathSync(root);
  }

  async *walk(
    filter: (entry: WalkEntry) => boolean
  ): AsyncIterableIterator<File> {
    yield* walkAllFiles(this.root, filter);
  }
}

async function* walkAllFiles(
  root: string,
  filter: (entry: WalkEntry) => boolean
): AsyncIterableIterator<File> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);

    if (entry.isSymlink) {
      continue;
    }

    const walkEntry = { path, ...entry };

    if (entry.isDirectory && filter(walkEntry)) {
      yield* walkAllFiles(path, filter);
    } else if (entry.isFile) {
      if (filter(walkEntry)) {
        const filePath = normalize(path);
        const info = await Deno.stat(filePath);

        const file = new File();

        file.name = basename(filePath);
        file.path = filePath;
        file.size = info.size;
        file.lastModified = info.mtime?.getTime();

        yield file;
      }
    }
  }
}
