import { format } from "datetime";
import convertSize from "convert_size";

import { createStorage } from "./storage.ts";

import cliFormat from "cli-format";

type SearchOptions = {
  key: string;
  database: string;
};

type FileOutput = {
  name: string;
  path: string;
  modifiedAt?: string;
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
      modifiedAt: ele.lastModified
        ? format(new Date(ele.lastModified), "yyyy-MM-dd HH:mm:ss")
        : undefined,
      size: ele.size ? convertSize(ele.size, { accuracy: 1 }) : undefined,
    });

    return memo;
  }, {} as { [fileSetPath: string]: Array<FileOutput> });

  const { columns } = Deno.consoleSize(Deno.stdout.rid);

  const timeWidth = 21;
  const sizeWidth = 10;
  const restWidth = columns - 5 - timeWidth - sizeWidth;
  const nameWidth = Math.ceil(restWidth * (columns > 140 ? 0.3 : 0.4)) - 2;
  const pathWidth = restWidth - nameWidth - 2;

  const lineSeparator = new Array(columns).fill("-").join("");

  Object.entries(outputs).forEach(([fileSetPath, files]) => {
    console.log(fileSetPath);
    console.log(new Array(columns).fill("=").join(""));

    files.forEach((file, index, array) => {
      console.log(
        cliFormat.columns.wrap(
          [
            {
              content: file.name,
              width: nameWidth,
            },
            {
              content: file.path,
              width: pathWidth,
            },
            {
              content: file.modifiedAt,
              width: 19,
            },
            {
              content: (file.size || "").padStart(8, " "),
              width: 8,
            },
          ],
          {
            width: columns - 4,
            paddingMiddle: " | ",
          }
        )
      );

      if (index < array.length - 1) {
        console.log(lineSeparator);
      }
    });

    console.log(new Array(columns).fill("=").join(""));
    console.log("total: %d", files.length);
    console.log("");
  });

  return storage.close();
}
