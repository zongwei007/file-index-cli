import Storage from "./storage.ts";
import { createWalker } from "./walker.ts";

type AddOptions = {
  database: string;
  password: string;
  src: string;
};

export default async function add(options: AddOptions) {
  const storage = await Storage.create(options.database);
  const walker = createWalker(options.src);

  const folder = await storage.folder(walker.root);
  const folderFiles = [];

  for await (const file of walker.walk(
    ({ name }) => !name.startsWith(".") && name !== "node_modules"
  )) {
    await storage.addFile(folder, file);

    folderFiles.push(file.path);
  }

  await storage.clearFiles(folder, walker.root, folderFiles);

  return storage.close();
}
