import * as log from "log";

import { getDatabase, isDryRun, QueryParam } from "../storage.ts";
import File from "./File.ts";

class Folder {
  id!: number;

  path!: string;

  createdAt!: Date;

  modifiedAt!: Date;

  constructor(record: Record<string, string | number>) {
    this.id = record.id as number;
    this.path = record.path as string;
    this.createdAt = new Date(record.created_at as number);
    this.modifiedAt = new Date(record.modified_at as number);
  }

  static query(
    cnd?: string,
    param?: Record<string, QueryParam> | QueryParam[]
  ): Folder[] {
    const sql =
      "SELECT id, path, created_at, modified_at FROM folders" +
      (cnd ? " WHERE " + cnd : "");

    log.debug(`Query folders by ${sql}; Param: ${cnd && param}`);

    const rows = [
      ...getDatabase()
        .query(sql, cnd ? param : undefined)
        .asObjects(),
    ];

    return rows.map((ele) => new Folder(ele));
  }

  isChild(path: string) {
    if (this.path === path) {
      return false;
    }

    return path.startsWith(this.path + this.pathSeparator());
  }

  pathSeparator() {
    return this.platform() === "linux" ? "/" : "\\";
  }

  platform() {
    return this.path.substring(0, 3).includes(":") ? "windows" : "linux";
  }

  findChildren(): Folder[] {
    return Folder.query("PATH like ?", [
      this.path + this.pathSeparator() + "%",
    ]);
  }

  diff(target: Folder, srcPath: string, targetPath: string) {
    const reducer = (path: string) => (memo: Map<string, File>, file: File) => {
      memo.set(file.path.substring(path.length + 1), file);
      return memo;
    };

    const srcFiles = File.query("folder_id = ? AND files.path like ?", [
      this.id,
      `${srcPath}%`,
    ]).reduce(reducer(srcPath), new Map<string, File>());

    const targetFiles = File.query("folder_id = ? AND files.path like ?", [
      target.id,
      `${targetPath}%`,
    ]).reduce(reducer(targetPath), new Map<string, File>());

    const addFiles = [];
    const removeFiles = [];

    for (const [path, file] of srcFiles.entries()) {
      if (!targetFiles.has(path)) {
        file.path = path;
        addFiles.push(file);
      }
    }

    for (const [path, file] of targetFiles.entries()) {
      if (!srcFiles.has(path)) {
        file.path = path;
        removeFiles.push(file);
      }
    }

    return [addFiles, removeFiles];
  }

  merge(...folders: Folder[]) {
    const sql = `UPDATE files SET path = (? || ? || path), folder_id = ? WHERE folder_id = ?`;
    const updater = getDatabase().prepareQuery(sql);

    for (const folder of folders) {
      const subpath = folder.path.substring(this.path.length + 1);
      const sqlParams = [subpath, folder.pathSeparator(), this.id, folder.id];

      log.debug(`Update files by ${sql}; Param: ${sqlParams}`);

      if (!isDryRun()) {
        updater(sqlParams);
      }
    }

    if (!isDryRun()) {
      folders.forEach((ele) => ele.delete());
    }
  }

  async sync(path: string, files: AsyncIterableIterator<File>) {
    const folderFiles = [];
    const pathPrefix = path ? path + this.pathSeparator() : "";

    for await (const file of files) {
      file.path = pathPrefix + file.path;

      this.addFile(file);

      folderFiles.push(file.path);
    }

    this.clearFiles(path, folderFiles);

    this.save();
  }

  delete() {
    log.debug(`Delete folder ${this.path}`);

    getDatabase().query("DELETE FROM files WHERE id = ?", [this.id]);
  }

  save() {
    const database = getDatabase();

    if (this.id) {
      log.debug(`Update folder ${this.path}`);

      this.modifiedAt = new Date();

      database.query(
        `UPDATE folders SET path = (?), modified_at = (?) WHERE id = ?`,
        [this.path, this.modifiedAt.getTime(), this.id]
      );
    } else {
      log.debug(`Create folder ${this.path}`);

      this.createdAt = this.modifiedAt = new Date();

      database.query(
        `INSERT INTO folders(path, created_at, modified_at) VALUES (?,?,?)`,
        [this.path, this.createdAt.getTime(), this.modifiedAt.getTime()]
      );

      this.id = database.lastInsertRowId;
    }
  }

  private addFile(file: File) {
    let [result] = File.query("files.path = ? AND folder_id = ?", [
      file.path,
      this.id,
    ]);

    if (result) {
      if (
        result.size !== file.size ||
        result.lastModified.getTime() !== file.lastModified.getTime()
      ) {
        result.size = file.size;
        result.lastModified = file.lastModified;

        if (!isDryRun()) {
          result.save();
        }
      }
    } else {
      result = file;
      result.folder = this;

      if (!isDryRun()) {
        result.save();
      }
    }

    return result;
  }

  private clearFiles(parent: string, includes: string[]) {
    const exists = new Set(
      File.query("files.path like ? AND folder_id = ?", [
        parent + "/%",
        this.id,
      ]).map((ele) => ele.path)
    );

    includes.forEach((ele) => exists.delete(ele));

    const database = getDatabase();
    const removed = [...exists];

    while (!isDryRun() && removed.length) {
      const paths = removed.splice(0, 100);
      const placeholder = new Array(paths.length).fill("?").join(",");

      log.debug(`Remove files: ${paths.join("\n")}`);

      database.query(
        `DELETE FROM files WHERE folder_id = ? AND path in (${placeholder})`,
        [this.id, ...paths]
      );
    }
  }
}

export default Folder;
