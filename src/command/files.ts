import convertSize from "convert_size";

import { File } from "../model/mod.ts";
import { printTable } from "../print.ts";

import type { TableColumn } from "../print.ts";

type SearchOptions = {
  key: string;
};

type FileOutput = {
  name: string;
  path: string;
  modifiedAt?: Date;
  size?: string;
};

export function search(options: SearchOptions) {
  const files = File.query(options.key ? "t0.path like ?" : undefined, [
    `%${options.key}%`,
  ]);

  const outputs = files.reduce<{ [fileSetPath: string]: Array<FileOutput> }>(
    (memo, ele) => {
      const folder = ele.folder!;

      if (!memo[folder.path]) {
        memo[folder.path] = [];
      }

      memo[folder.path].push({
        name: ele.name,
        path: ele.path,
        modifiedAt: ele.lastModified,
        size: ele.size ? convertSize(ele.size, { accuracy: 1 }) : undefined,
      });

      return memo;
    },
    {}
  );

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

  return Promise.resolve();
}
