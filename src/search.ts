import { format } from "https://deno.land/std@0.89.0/datetime/mod.ts";
import "https://deno.land/x/humanizer@1.0/byteSize.ts";

import Storage from "./storage.ts";

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
  const storage = await Storage.create(options.database);

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
      size: ele.size ? ele.size.bytes().toString(0) : undefined,
    });

    return memo;
  }, {} as { [fileSetPath: string]: Array<FileOutput> });

  Object.entries(outputs).forEach(([fileSetPath, files]) => {
    console.log(fileSetPath);

    console.table(files);
  });

  return storage.close();
}
