import { basename, join, normalize } from "path";
import { readLines } from "io";
import * as log from "log";

import { File } from "./model/mod.ts";

const LINE_MATCHER = /^(\S+) +?(\d+) (\S+) (\S+)\s+(\d+) (\d+) ([\S\s]+)$/;

interface WalkEntry extends Deno.DirEntry {
  path: string;
}

export interface Walker {
  root: string;
  path: string;

  walk: (filter: (entry: WalkEntry) => boolean) => AsyncIterableIterator<File>;
}

export function prunePath(path: string) {
  if (path.endsWith("/") || path.endsWith("\\")) {
    return path.substring(0, path.length - 1);
  }

  return path;
}

export async function createWalker(root: string): Promise<Walker> {
  if (await isLocalPath(root)) {
    return new LocalWalker(root);
  } else {
    return new CommanderWalker(root);
  }
}

class CommanderWalker implements Walker {
  host: string;
  path: string;
  root: string;
  user?: string;

  constructor(source: string) {
    this.user = source.includes("@")
      ? source.substring(0, source.indexOf("@"))
      : undefined;
    this.host = this.user
      ? source.substring(this.user.length + 1, source.indexOf(":"))
      : source.substring(0, source.indexOf(":"));
    this.path = prunePath(source.substring(source.indexOf(":") + 1));
    this.root = this.host + ":" + this.path;
  }

  async *walk(
    filter: (entry: WalkEntry) => boolean,
  ): AsyncIterableIterator<File> {
    const fullHost = [this.user, this.host].filter(Boolean).join("@");
    const command =
      `ssh ${fullHost} ls -R -l --time-style +%s '${this.path}' > ./.swap.tmp`;

    log.debug(`Execute command：${command}`);

    const processor = new Deno.Command(
      Deno.build.os === "windows" ? "cmd" : "sh",
      {
        args: Deno.build.os === "windows" ? ["/C", command] : ["-c", command],
      },
    );

    const { code, stderr } = await processor.output();

    try {
      if (code === 0) {
        const fileReader = await Deno.open("./.swap.tmp");

        let folderPath = "";
        const ignoreFolders: string[] = [];

        for await (const line of readLines(fileReader)) {
          if (line.startsWith(this.path) && line.endsWith(":")) {
            folderPath = line
              .substring(0, line.length - 1)
              .substring(this.path.length + 1);

            log.debug(`Begin traverse folder ${folderPath}`);

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
            path: folderPath.length ? `${folderPath}/${groups[7]}` : groups[7],
            isFile: groups[1].charAt(0) === "-",
            isDirectory: groups[1].charAt(0) === "d",
            isSymlink: groups[1].charAt(0) === "l",
          };

          if (ignoreFolders.some((path) => entry.path.startsWith(path))) {
            log.debug(`Ignore path ${entry.path}`);
            continue;
          }

          if (entry.isDirectory) {
            // 写入目录忽略信息
            if (!filter(entry)) {
              log.debug(`Ignore path ${entry.path}`);

              ignoreFolders.push(entry.path);
            }

            //仅读取文件，目录等待后续处理
            continue;
          }

          if (filter(entry)) {
            const file = new File({
              size: parseInt(groups[5]),
              last_modified: parseInt(groups[6]) * 1000,
              name: entry.name,
              path: entry.path,
            });

            yield file;
          } else {
            log.debug(`Ignore file ${entry.path}`);
          }
        }
      } else {
        const message = new TextDecoder().decode(stderr);
        console.error("execute fail", code, message);

        throw Error(message);
      }
    } finally {
      await Deno.remove("./.swap.tmp");
    }
  }
}

class LocalWalker implements Walker {
  path: string;
  root: string;

  constructor(root: string) {
    this.path = this.root = Deno.realPathSync(root);
  }

  async *walk(
    filter: (entry: WalkEntry) => boolean,
  ): AsyncIterableIterator<File> {
    yield* walkAllFiles(this.root, filter);
  }
}

async function* walkAllFiles(
  root: string,
  filter: (entry: WalkEntry) => boolean,
): AsyncIterableIterator<File> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);

    if (entry.isSymlink) {
      continue;
    }

    const walkEntry = { path, ...entry };

    if (entry.isDirectory) {
      if (filter(walkEntry)) {
        yield* walkAllFiles(path, filter);
      } else {
        log.debug(`Ignore path ${walkEntry.path}`);
      }
    } else if (entry.isFile) {
      if (filter(walkEntry)) {
        const filePath = normalize(path);
        const info = await Deno.stat(filePath);

        const file = new File({
          name: basename(filePath),
          path: filePath.substring(root.length + 1),
          size: info.size,
          lastModified: info.mtime?.getTime() || 0,
        });

        yield file;
      } else {
        log.debug(`Ignore file ${walkEntry.path}`);
      }
    }
  }
}

async function isLocalPath(path: string) {
  if (Deno.build.os === "windows") {
    const command = new Deno.Command("wmic", {
      args: ["logicaldisk", "get", "deviceid"],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();

    if (code === 0) {
      const lines = new TextDecoder().decode(stdout).split("\n");

      return lines
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => normalize(`${line}\\`))
        .some((line) => normalize(path).startsWith(line));
    }

    throw Error(new TextDecoder().decode(stderr));
  } else {
    return !path.includes(":");
  }
}
