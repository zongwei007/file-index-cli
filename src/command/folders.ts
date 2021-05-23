import { Folder } from "../model/mod.ts";
import { createWalker } from "../walker.ts";
import { printTable } from "../print.ts";

import type { TableColumn } from "../print.ts";

type IndexOptions = {
  path: string;
};

type ListOptions = {
  key?: string;
};

type MoveOptions = {
  src: string;
  target: string;
};

export async function index(options: IndexOptions) {
  const walker = await createWalker(options.path);

  let folder = findMatchFolder(walker.root);

  // 如果匹配目录不存在
  if (!folder) {
    folder = createFolder(walker.root);
  }

  await folder!.sync(
    // 'ab/cd'.substring('ab'.length + 1) => cd
    walker.root.substring(folder.path.length + 1),
    walker.walk(({ name }) => !name.startsWith(".") && name !== "node_modules")
  );
}

export async function move(options: MoveOptions) {
  const [src] = Folder.query("path = ?", [options.src]);

  if (!src) {
    throw new Error(`Folder ${options.src} is not found`);
  }

  const walker = await createWalker(options.target);
  const targetFolder = findMatchFolder(walker.root);

  if (targetFolder) {
    targetFolder.merge(src);
  } else {
    src.path = options.target;
    src.save();
  }
}

export function list(options: ListOptions) {
  const folders = Folder.query(options.key ? "path like ?" : undefined, [
    `%${options.key}%`,
  ]);

  const columns: TableColumn[] = [
    {
      name: "path",
    },
    {
      name: "createdAt",
      width: 19,
    },
    {
      name: "modifiedAt",
      width: 19,
    },
  ];

  printTable(
    columns,
    folders.map((ele) => ({
      path: ele.path,
      createdAt: ele.createdAt,
      modifiedAt: ele.modifiedAt,
    }))
  );

  return Promise.resolve();
}

/** 按路径获取匹配目录。匹配规则为路径一致或为目录的子目录 */
function findMatchFolder(path: string) {
  const folders = Folder.query();

  let folder = folders.find((ele) => ele.path === path);

  // 如果匹配目录不存在
  if (!folder) {
    // 试试匹配父级
    folder = folders.find((ele) => ele.isChild(path));
  }

  return folder || null;
}

function createFolder(path: string) {
  const folder = new Folder({ path });

  folder.save();

  const children = folder.findChildren();

  folder.merge(...children);

  return folder;
}
