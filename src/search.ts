import { format } from "datetime";
import convertSize from "convert_size";

import { createStorage } from "./storage.ts";

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
        ? format(new Date(ele.lastModified * 1000), "yyyy-MM-dd HH:mm:ss")
        : undefined,
      size: ele.size ? convertSize(ele.size, { accuracy: 1 }) : undefined,
    });

    return memo;
  }, {} as { [fileSetPath: string]: Array<FileOutput> });

  Object.entries(outputs).forEach(([fileSetPath, files]) => {
    console.log(fileSetPath);

    console.table(files);
  });

  return storage.close();
}
