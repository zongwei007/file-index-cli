import { createStorage } from "./storage.ts";
import { createWalker } from "./walker.ts";
import * as log from "log";

type AddOptions = {
  database: string;
  dryRun?: boolean;
  src: string;
  verbose?: boolean;
};

export default async function add(options: AddOptions) {
  const storage = await createStorage(options.database, !!options.dryRun);
  const walker = createWalker(options.src);

  const folder = await storage.folder(walker.root);
  const folderFiles = [];

  for await (const file of walker.walk(
    ({ name }) => !name.startsWith(".") && name !== "node_modules"
  )) {
    await storage.addFile(folder, file);

    folderFiles.push(file.path);
  }

  await storage.clearFiles(folder, walker.path, folderFiles);

  return storage.close();
}
