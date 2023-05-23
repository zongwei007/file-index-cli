import * as log from "log";
import Folder from "./Folder.ts";

import { getDatabase, type QueryParameter } from "../storage.ts";

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
    param?: Array<[string, QueryParameter] | [string, string, QueryParameter]>,
  ): File[] {
    let sql = `
      SELECT
        files.id, files.name, files.path, files.size, files.last_modified, files.created_at, files.modified_at,
        folders.id as did, folders.path as dpath, folders.created_at as dca, folders.modified_at as dma
      FROM
        files
      LEFT JOIN
        folders ON files.folder_id = folders.id
    `;
    const values: Record<string, QueryParameter> = {};

    if (param?.length) {
      sql = sql + " WHERE " + param.map(([field, op, val], i) => {
        const key = `${field}_${i}`;
        const path = field.includes(".") ? field : `files.${field}`;

        if (val) {
          values[key] = val;
          return `${path} ${op} :${key}`;
        } else {
          values[key] = val = op;
          return `${path} = :${key}`;
        }
      }).join(" AND ");
    }

    log.debug(`Query files by ${sql}; Param: ${JSON.stringify(values)}`);

    const query = getDatabase().prepareQuery<
      [
        number,
        string,
        string,
        number,
        number,
        number,
        number,
        number,
        string,
        number,
        number,
      ],
      {
        id: number;
        name: string;
        path: string;
        size: number;
        last_modified: number;
        created_at: number;
        modified_at: number;
        did: number;
        dpath: string;
        dca: number;
        dma: number;
      }
    >(sql);

    const rows = param ? query.allEntries(values) : query.allEntries();

    return rows.map((row) => {
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

      const updater = database.prepareQuery<
        [number],
        never,
        {
          id: number;
          name: string;
          path: string;
          size: number;
          folderId: number;
          lastModified: number;
          modifiedAt: number;
        }
      >(
        `UPDATE files SET name = :name, path = :path, size = :size, last_modified = :lastModified, folder_id = :folderId, modified_at = :modifiedAt WHERE id = :id`,
      );

      updater.execute({
        id: this.id,
        name: this.name,
        path: this.path,
        size: this.size,
        folderId: this.folder!.id,
        lastModified: this.lastModified.getTime(),
        modifiedAt: this.modifiedAt.getTime(),
      });
    } else {
      log.debug(`Create file ${this.folder?.path}/${this.path}`);

      this.createdAt = this.modifiedAt = new Date();

      const updater = database.prepareQuery<
        [number],
        never,
        {
          name: string;
          path: string;
          size: number;
          folderId: number;
          lastModified: number;
          createdAt: number;
          modifiedAt: number;
        }
      >(
        `INSERT INTO files(name, path, size, last_modified, folder_id, created_at, modified_at) VALUES (:name, :path, :size, :lastModified, :folderId, :createdAt, :modifiedAt)`,
      );

      updater.execute({
        name: this.name,
        path: this.path,
        size: this.size,
        folderId: this.folder!.id,
        lastModified: this.lastModified.getTime(),
        createdAt: this.createdAt.getTime(),
        modifiedAt: this.modifiedAt.getTime(),
      });

      this.id = database.lastInsertRowId;
    }
  }
}

export default File;
