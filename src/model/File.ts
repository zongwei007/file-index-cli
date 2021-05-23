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
        t0.id, t0.name, t0.path, t0.size, t0.last_modified, t0.created_at, t0.modified_at,
        t1.id as did, t1.path as dpath, t1.created_at as dca, t1.modified_at as dma
      FROM
        files as t0
      LEFT JOIN
        folders as t1 ON t0.folder_id = t1.id
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
