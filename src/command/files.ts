import convertSize from "convert_size";

import { File } from "../model/mod.ts";

import type { TableColumn } from "../print.ts";

type SearchOptions = {
  folder?: string;
  keywords: string[];
};

type FileOutput = {
  name: string;
  path: string;
  modifiedAt?: Date;
  size?: string;
};

export function search(options: SearchOptions) {
  let cnds =
    new Array(options.keywords.length)
      .fill("files.path like ?")
      .join(" AND ") || undefined;
  let param = cnds ? options.keywords.map((w) => `%${w}%`) : [];

  if (options.folder) {
    cnds = [cnds, "folders.path like ?"].filter(Boolean).join(" AND ");
    param = param.concat([`%${options.folder}%`]);
  }

  const files = File.query(cnds, param);

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

  return { columns, outputs };
}
