import { ensureFile, exists } from "https://deno.land/std@0.89.0/fs/mod.ts";
import { connect, Q } from "https://deno.land/x/cotton@v0.7.5/mod.ts";
import { Adapter } from "https://deno.land/x/cotton@v0.7.5/src/adapters/adapter.ts";
import { getTableName } from "https://deno.land/x/cotton@v0.7.5/src/utils/models.ts";

import logger from "./logger.ts";
import { File, Folder } from "./model/mod.ts";

class Storage {
  private db: Adapter;
  private dryRun: boolean;

  constructor(db: Adapter, dryRun: boolean) {
    this.db = db;
    this.dryRun = dryRun;
  }

  /** 创建或获取文件集合 */
  public async folder(path: string, withFiles = false): Promise<Folder> {
    const separator = path.includes("/") ? "/" : "\\";

    const folders = await Folder.query().all();

    let folder = folders.find((ele) => ele.path === path);

    // 如果匹配目录不存在
    if (!folder) {
      // 试试匹配父级
      folder = folders.find((ele) => path.startsWith(ele.path + separator));

      // 父级不存在，则创建新的目录
      if (!folder) {
        folder = new Folder();
        folder.path = path;

        await folder.save();
      }
    }

    //父级创建后，将所有子集目录下的数据收归自身名下
    const children = folders.filter((ele) =>
      ele.path.startsWith(folder!.path + separator)
    );

    await this.db
      .table(getTableName(File))
      .where("folder_id", Q.in(children.map((ele) => ele.id)))
      .update({ folder_id: folder.id })
      .execute();

    await Promise.all(children.map((child) => child.remove()));

    return folder;
  }

  public async addFile(folder: Folder, file: File) {
    let result = await File.query().where("path", file.path).first();

    if (result) {
      if (
        result.size !== file.size ||
        result.lastModified !== file.lastModified
      ) {
        result.size = file.size;
        result.lastModified = file.lastModified;

        logger.debug("更新文件 %s", file.path);

        if (!this.dryRun) {
          await result.save();
        }
      }
    } else {
      result = file;
      result.folder = folder;

      logger.debug("新增文件 %s", file.path);

      if (!this.dryRun) {
        await result.save();
      }
    }

    return result;
  }

  public async clearFiles(folder: Folder, parent: string, includes: string[]) {
    const exists = new Set(
      (
        await File.query()
          .where("path", Q.like(parent + "/%"))
          .all()
      ).map((ele) => ele.path)
    );

    includes.forEach((ele) => exists.delete(ele));

    const removed = [...exists];

    while (!this.dryRun && removed.length) {
      await this.db
        .table(getTableName(File))
        .where("folder_id", Q.eq(folder.id))
        .where("path", Q.in(removed.splice(0, 100)))
        .delete()
        .execute();
    }

    removed.forEach((ele) => logger.debug("删除文件 %s", ele));
  }

  public async searchFile(key: string): Promise<File[]> {
    return await File.query()
      .where("path", Q.like(`%${key}%`))
      .include("folder")
      .all();
  }

  public close(): Promise<void> {
    return this.db.disconnect();
  }
}

export async function createStorage(dbPath: string, dryRun = false) {
  await ensureFile(dbPath);

  const db = await connect({
    type: "sqlite",
    database: dbPath,
    models: [File, Folder],
  });

  if (!(await Deno.stat(dbPath)).size) {
    logger.debug("初始化数据库");

    await Promise.all(
      `
    CREATE TABLE folders (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, created_at NUMBER, modified_at NUMBER);
    CREATE TABLE files (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, path TEXT, size INTEGER, last_modified NUMBER, created_at NUMBER, folder_id INTEGER);
    CREATE UNIQUE INDEX uq_folder IF NOT EXISTS ON folders (path);
    CREATE UNIQUE INDEX uq_file IF NOT EXISTS ON files (path,folder_id);
    `
        .split(";")
        .map((ele) => ele.trim())
        .map((ele) => db.query(ele))
    );

    logger.debug("初始化数据库完毕");
  }

  return new Storage(db, dryRun);
}
