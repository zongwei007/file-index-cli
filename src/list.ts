import { createStorage } from "./storage.ts";

import { printTable } from "./print.ts";

import type { TableColumn } from "./print.ts";

type ListOptions = {
  database: string;
  key?: string;
};

export async function listFolders(options: ListOptions) {
  const storage = await createStorage(options.database);
  const folders = await storage.searchFolder(options.key);

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
      createdAt: new Date(ele.createdAt),
      modifiedAt: new Date(ele.modifiedAt),
    }))
  );
}
