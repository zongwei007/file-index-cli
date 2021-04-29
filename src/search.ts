import convertSize from "convert_size";

import { createStorage } from "./storage.ts";
import { printTable } from "./print.ts";

import type { TableColumn } from "./print.ts";

type SearchOptions = {
  key: string;
  database: string;
};

type FileOutput = {
  name: string;
  path: string;
  modifiedAt?: Date;
  size?: string;
};

export default async function search(options: SearchOptions) {
  const storage = await createStorage(options.database);

  const files = await storage.searchFile(options.key);

  const outputs = files.reduce((memo, ele) => {
    if (!memo[ele.folder.path]) {
      memo[ele.folder.path] = [];
    }

    memo[ele.folder.path].push({
      name: ele.name,
      path: ele.path,
      modifiedAt: ele.lastModified ? new Date(ele.lastModified) : undefined,
      size: ele.size ? convertSize(ele.size, { accuracy: 1 }) : undefined,
    });

    return memo;
  }, {} as { [fileSetPath: string]: Array<FileOutput> });

  const { columns: screenWidth } = Deno.consoleSize(Deno.stdout.rid);

  const columns: TableColumn[] = [
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

  Object.entries(outputs).forEach(([fileSetPath, files]) => {
    console.log(fileSetPath);

    printTable(columns, files);

    console.log("total: %d", files.length);
    console.log("");
  });

  return storage.close();
}
