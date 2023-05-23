import * as log from "log";

import { getDatabase, isDryRun, type QueryParameter } from "../storage.ts";
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
    param?: Array<[string, QueryParameter] | [string, string, QueryParameter]>,
  ): Folder[] {
    let sql = "SELECT id, path, created_at, modified_at FROM folders";
    const values: Record<string, QueryParameter> = {};

    if (param?.length) {
      sql = " WHERE " + param.map(([field, op, val], i) => {
        const key = `${field}_${i}`;

        if (val) {
          values[key] = val;
          return `${field} ${op} :${key}}`;
        } else {
          values[key] = val = op;
          return `${field} = :${key}`;
        }
      }).join(" AND ");
    }

    log.debug(`Query folders by ${sql}; Param: ${JSON.stringify(values)}`);

    const query = getDatabase().prepareQuery<[number, string, string, string], {
      id: number;
      path: string;
      created_at: number;
      modified_at: number;
    }>(sql);

    const rows = param ? query.allEntries(values) : query.allEntries();

    return rows.map((row) => new Folder(row));
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
    return Folder.query([
      ["path", "LIKE", this.path + this.pathSeparator() + "%"],
    ]);
  }

  diff(target: Folder, srcPath: string, targetPath: string) {
    const reducer = (path: string) => (memo: Map<string, File>, file: File) => {
      memo.set(file.path.substring(path.length + 1), file);
      return memo;
    };

    const srcFiles = File.query([
      ["folder_id", this.id],
      ["path", "LIKE", `${srcPath}%`],
    ]).reduce(reducer(srcPath), new Map<string, File>());

    const targetFiles = File.query([
      ["folder_id", target.id],
      ["path", "LIKE", `${targetPath}%`],
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
    const sql =
      `UPDATE files SET path = :prefix || path, folder_id = :id WHERE folder_id = :folderId`;

    const updater = getDatabase().prepareQuery<
      [number],
      never,
      { prefix: string; id: number; folderId: number }
    >(sql);

    for (const folder of folders) {
      const subpath = folder.path.substring(this.path.length + 1);
      const sqlParams = {
        prefix: subpath + folder.pathSeparator(),
        id: this.id,
        folderId: folder.id,
      };

      log.debug(`Update files by ${sql}; Param: ${JSON.stringify(sqlParams)}`);

      if (!isDryRun()) {
        updater.execute(sqlParams);
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
        [this.path, this.modifiedAt.getTime(), this.id],
      );
    } else {
      log.debug(`Create folder ${this.path}`);

      this.createdAt = this.modifiedAt = new Date();

      database.query(
        `INSERT INTO folders(path, created_at, modified_at) VALUES (?,?,?)`,
        [this.path, this.createdAt.getTime(), this.modifiedAt.getTime()],
      );

      this.id = database.lastInsertRowId;
    }
  }

  private addFile(file: File) {
    let [result] = File.query([
      ["folder_id", this.id],
      ["path", file.path],
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
      File.query([
        ["folder_id", this.id],
        ["path", "LIKE", parent + "/%"],
      ]).map((ele) => ele.path),
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
        [this.id, ...paths],
      );
    }
  }
}

export default Folder;
