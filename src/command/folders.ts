import convert from "convert_pro";

import { File, Folder } from "../model/mod.ts";
import { createWalker, prunePath } from "../walker.ts";

import type { TableColumn } from "../print.ts";

type DiffOptions = {
  src: string;
  target: string;
  type?: "add" | "remove";
};

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

export function diff(options: DiffOptions) {
  const folders = Folder.query();
  const src = folders.find((ele) => options.src.startsWith(ele.path));
  const target = folders.find((ele) => options.target.startsWith(ele.path));

  if (!src) {
    throw new Error(`Folder ${options.src} is not found`);
  }

  if (!target) {
    throw new Error(`Folder ${options.target} is not found`);
  }

  const srcPath = prunePath(options.src.substring(src.path.length + 1));
  const targetPath = prunePath(
    options.target.substring(target.path.length + 1),
  );

  const [addFiles, removeFiles] = src.diff(target, srcPath, targetPath);

  const { columns: screenWidth } = Deno.consoleSize();

  const outputType = options.type ? [options.type] : ["add", "remove"];
  const mapper = (type: string) => (file: File) => ({
    type,
    name: file.name,
    path: file.path,
    modifiedAt: file.lastModified,
    size: file.size ? convert.bytes(file.size, { accuracy: 1 }) : "",
  });

  const rows = [
    ...(outputType.includes("add") ? addFiles.map(mapper("add")) : []),
    ...(outputType.includes("remove") ? removeFiles.map(mapper("remove")) : []),
  ];

  const columns: TableColumn[] = [
    {
      name: "type",
      width: 6,
    },
    {
      name: "name",
      width: Math.ceil(screenWidth * (screenWidth > 140 ? 0.2 : 0.3)),
    },
    {
      name: "path",
    },
    {
      name: "modifiedAt",
      width: 19,
    },
    {
      name: "size",
      width: 8,
      align: "right",
    },
  ];

  return { columns, rows };
}

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
    walker.walk(({ name }) => !name.startsWith(".") && name !== "node_modules"),
  );
}

export async function move(options: MoveOptions) {
  const [src] = Folder.query([["path", options.src]]);

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
  const folders = options.key
    ? Folder.query([["path", "LIKE", `%${options.key}%`]])
    : Folder.query();

  const rows = folders.map((ele) => ({
    path: ele.path,
    createdAt: ele.createdAt,
    modifiedAt: ele.modifiedAt,
  }));

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

  return { columns, rows };
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
