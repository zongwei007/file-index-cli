import {
  basename,
  join,
  normalize,
} from "https://deno.land/std@0.89.0/path/mod.ts";

import Storage from "./storage.ts";

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
  size?: number;
  modifiedAt?: Date;
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
  const fileSet = await storage.fileSet(path);

  for await (const entry of walk(path, {
    filter: ({ name }) => !name.startsWith("."),
  })) {
    if (entry.isFile) {
      await fileSet.addFile(entry);
    }
  }

  return storage.close();
}

async function _createWalkEntry(path: string): Promise<WalkEntry> {
  path = normalize(path);
  const name = basename(path);
  const info = await Deno.stat(path);

  return {
    path,
    name,
    size: info.size,
    modifiedAt: info.mtime || undefined,
    isFile: info.isFile,
    isDirectory: info.isDirectory,
    isSymlink: info.isSymlink,
  };
}

async function* walk(
  root: string,
  { filter = () => true }: WalkOptions = {}
): AsyncIterableIterator<WalkEntry> {
  for await (const entry of Deno.readDir(root)) {
    const path = join(root, entry.name);

    if (entry.isSymlink) {
      continue;
    }

    if (entry.isDirectory && filter({ path, ...entry })) {
      yield* walk(path, { filter });
    } else if (entry.isFile) {
      const walkEntry = await _createWalkEntry(path);

      if (filter(walkEntry)) {
        yield walkEntry;
      }
    } else if (filter({ path, ...entry })) {
      yield* walk(path, { filter });
    }
  }
}
