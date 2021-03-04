import Storage from "./storage.ts";

type SearchOptions = {
  key: string;
  database: string;
};

type FileOutput = {
  name: string;
  path: string;
  modifiedAt?: Date;
  size?: number;
};

export default async function search(options: SearchOptions) {
  const storage = await Storage.create(options.database);

  const files = await storage.searchFile(options.key);

  const outputs = files.reduce((memo, ele) => {
    if (!memo[ele.fileSetPath]) {
      memo[ele.fileSetPath] = [];
    }

    memo[ele.fileSetPath].push({
      name: ele.name,
      path: ele.path,
      modifiedAt: ele.modifiedAt,
      size: ele.size,
    });

    return memo;
  }, {} as { [fileSetPath: string]: Array<FileOutput> });

  Object.entries(outputs).forEach(([fileSetPath, files]) => {
    console.log(fileSetPath);

    console.table(files);
  });

  return storage.close();
}
