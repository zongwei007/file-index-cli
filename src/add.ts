import {
  basename,
  join,
  normalize,
} from "https://deno.land/std@0.89.0/path/mod.ts";

import Storage from "./storage.ts";
import { File } from "./model/mod.ts";

type AddOptions = {
  database: string;
  password: string;
  src: string;
};

type WalkOptions = {
  filter?: (entry: WalkEntry) => boolean;
};

interface WalkEntry extends Deno.DirEntry {
  path: string;
}

export default function add(options: AddOptions) {
  if (options.src.includes(":") && options.src.includes("@")) {
    addRemotePath(options);
  } else {
    addLocalPath(options);
  }
}

function addRemotePath(options: AddOptions) {}

async function addLocalPath(options: Pick<AddOptions, "database" | "src">) {
  const path = await Deno.realPath(options.src);
  const storage = await Storage.create(options.database);
  const folder = await storage.folder(path, true);
  const folderFiles = new Set<string>();

  for (const file of folder.files || []) {
    folderFiles.add(file.path);
  }

  const filter = ({ name }: WalkEntry) => !name.startsWith(".");

  for await (const file of walkAllFiles(path, { filter })) {
    await storage.addFile(folder, file);

    folderFiles.delete(file.path);
  }

  await storage.removeFileByPath(folder, ...folderFiles);

  return storage.close();
}

async function* walkAllFiles(
  root: string,
  { filter = () => true }: WalkOptions = {}
): AsyncIterableIterator<File> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);

    if (entry.isSymlink) {
      continue;
    }

    const walkEntry = { path, ...entry };

    if (entry.isDirectory && filter(walkEntry)) {
      yield* walkAllFiles(path, { filter });
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
