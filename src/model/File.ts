import Folder from "./Folder.ts";
import * as log from "log";

import { getDatabase, QueryParam } from "../storage.ts";

class File {
  id!: number;

  name!: string;

  path!: string;

  size!: number;

  lastModified!: Date;

  createdAt!: Date;

  modifiedAt!: Date;

  folder?: Folder;

  constructor(record: Record<string, string | number>, folder?: Folder) {
    this.id = record.id as number;
    this.name = record.name as string;
    this.path = record.path as string;
    this.size = record.size as number;
    this.lastModified = new Date(record.last_modified as number);
    this.createdAt = new Date(record.created_at as number);
    this.modifiedAt = new Date(record.modified_at as number);
    this.folder = folder;
  }

  static query(
    cnd?: string,
    param?: Record<string, QueryParam> | QueryParam[]
  ): File[] {
    const sql = `
      SELECT
        files.id, files.name, files.path, files.size, files.last_modified, files.created_at, files.modified_at,
        folders.id as did, folders.path as dpath, folders.created_at as dca, folders.modified_at as dma
      FROM
        files
      LEFT JOIN
        folders ON files.folder_id = folders.id
      ${cnd ? "WHERE " + cnd : ""}
    `;

    log.debug(`Query files by ${sql}; Param: ${cnd && param}`);

    const rows = getDatabase()
      .query(sql, cnd ? param : undefined)
      .asObjects();

    return [...rows].map((row) => {
      const folder = new Folder({
        id: row.did,
        path: row.dpath,
        created_at: row.dca,
        modified_at: row.dma,
      });

      return new File(row, folder);
    });
  }

  delete() {
    log.debug(`Delete file ${this.folder?.path}/${this.path}`);

    getDatabase().query("DELETE FROM files WHERE id = ?", [this.id]);
  }

  save() {
    const database = getDatabase();
    if (this.id) {
      log.debug(`Update file ${this.folder?.path}/${this.path}`);

      this.modifiedAt = new Date();

      database.query(
        `UPDATE files SET name = ?, path = ?, size = ?, last_modified = ?, folder_id = ?, modified_at = ? WHERE id = ?`,
        [
          this.name,
          this.path,
          this.size,
          this.folder!.id,
          this.lastModified.getTime(),
          this.modifiedAt.getTime(),
        ]
      );
    } else {
      log.debug(`Create file ${this.folder?.path}/${this.path}`);

      this.createdAt = this.modifiedAt = new Date();

      database.query(
        `INSERT INTO files(name, path, size, last_modified, folder_id, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          this.name,
          this.path,
          this.size,
          this.lastModified.getTime(),
          this.folder!.id,
          this.createdAt.getTime(),
          this.modifiedAt.getTime(),
        ]
      );

      this.id = database.lastInsertRowId;
    }
  }
}

export default File;
