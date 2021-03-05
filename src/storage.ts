import { ensureFile } from "https://deno.land/std@0.89.0/fs/mod.ts";
import { connect, Q } from "https://deno.land/x/cotton@v0.7.5/mod.ts";
import { Adapter } from "https://deno.land/x/cotton@v0.7.5/src/adapters/adapter.ts";
import { getTableName } from "https://deno.land/x/cotton@v0.7.5/src/utils/models.ts";

import { File, Folder } from "./model/mod.ts";

class Storage {
  private db: Adapter;

  constructor(db: Adapter) {
    this.db = db;
  }

  static create = async function (dbPath: string) {
    await ensureFile(dbPath);

    const db = await connect({
      type: "sqlite",
      database: dbPath,
      models: [File, Folder],
    });

    await db.query(
      "CREATE TABLE IF NOT EXISTS folders (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, created_at NUMBER, modified_at NUMBER)"
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, path TEXT, size INTEGER, last_modified NUMBER, created_at NUMBER, folder_id INTEGER)"
    );

    return new Storage(db);
  };

  /** 创建或获取文件集合 */
  public async folder(path: string, withFiles = false) {
    const separator = path.includes("/") ? "/" : "\\";

    const paths = path
      .split(/[/\\]/)
      .reduce(
        (memo, _ele, index, array) => [
          ...memo,
          array.slice(0, index + 1).join(separator),
        ],
        [] as string[]
      );

    const query = Folder.query().where("path", Q.in(paths));

    let folder = await (withFiles ? query.include("files") : query).first();

    if (folder) {
      if (folder.path.length > path.length) {
        folder.path = path;
        folder.modifiedAt = Date.now();

        await folder.save();
      }
    } else {
      folder = new Folder();
      folder.path = path;

      await folder.save();
    }

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

        await result.save();
      }
    } else {
      result = file;
      result.folder = folder;
      await result.save();
    }

    return result;
  }

  public async removeFileByPath(folder: Folder, ...path: string[]) {
    const result = await this.db
      .table(getTableName(File))
      .where("folder_id", Q.eq(folder.id))
      .where("path", Q.in(path))
      .delete()
      .execute();

    console.log(result);

    return result;
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

export default Storage;
