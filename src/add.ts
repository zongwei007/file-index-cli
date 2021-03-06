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
  const folderFiles = new Set<string>();

  for (const file of folder.files || []) {
    folderFiles.add(file.path);
  }

  for await (const file of walker.walk(({ name }) => !name.startsWith("."))) {
    await storage.addFile(folder, file);

    folderFiles.delete(file.path);
  }

  await storage.removeFileByPath(folder, ...folderFiles);

  return storage.close();
}
