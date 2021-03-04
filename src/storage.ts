import { ensureFile } from "https://deno.land/std@0.89.0/fs/mod.ts";
import { v4 as uuid } from "https://deno.land/std@0.89.0/uuid/mod.ts";
import { connect, Q } from "https://deno.land/x/cotton@v0.7.5/mod.ts";
import { Adapter } from "https://deno.land/x/cotton@v0.7.5/src/adapters/adapter.ts";

type File = {
  fileSetId?: string;
  id?: string;
  modifiedAt?: Date;
  name: string;
  path: string;
  size?: number;
};

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
    });

    await db.query(
      "CREATE TABLE IF NOT EXISTS file_set (id TEXT PRIMARY KEY, path TEXT)"
    );
    await db.query(
      "CREATE TABLE IF NOT EXISTS file (id TEXT PRIMARY KEY, path TEXT, name TEXT, size INTEGER, modified_at TEXT, file_set_id TEXT)"
    );

    return new Storage(db);
  };

  /** 创建或获取文件集合 */
  public async fileSet(path: string) {
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

    let [target] = (await this.db
      .table("file_set")
      .select("id", "path")
      .where("path", Q.in(paths))
      .execute()) as Pick<FileSet, "id" | "path">[];

    if (target) {
      if (target.path.length > path.length) {
        await this.db
          .table("file_set")
          .where("id", target.id)
          .update({ path })
          .execute();
      }
    } else {
      await this.db
        .table("file_set")
        .insert((target = { id: uuid.generate(), path }))
        .execute();
    }

    return new FileSet(this.db, target.id, target.path);
  }

  public async searchFile(
    key: string
  ): Promise<(File & { fileSetPath: string })[]> {
    const result = (await this.db
      .table("file")
      .leftJoin("file_set", "file_set_id", "file_set.id")
      .select("file.*", ["file_set.path", "file_set_path"])
      .where("file.path", Q.like(`%${key}%`))
      .execute()) as (File & {
      modified_at: string;
      file_set_id: string;
      file_set_path: string;
    })[];

    return result.map(
      ({ file_set_id, file_set_path, modified_at, ...ele }) => ({
        ...ele,
        fileSetId: file_set_id,
        fileSetPath: file_set_path,
        modifiedAt: new Date(modified_at),
      })
    );
  }

  public close(): Promise<void> {
    return this.db.disconnect();
  }
}

export default Storage;

class FileSet {
  private db: Adapter;

  id: string;
  path: string;

  constructor(db: Adapter, id: string, path: string) {
    this.db = db;
    this.id = id;
    this.path = path;
  }

  public async addFile(file: File) {
    const [record] = (await this.db
      .table("file")
      .where("path", file.path)
      .where("file_set_id", this.id)
      .execute()) as (File & { modified_at: string })[];

    if (record) {
      if (
        file.modifiedAt &&
        (!record.modified_at || new Date(record.modified_at) != file.modifiedAt)
      ) {
        await this.db
          .table("file")
          .where("id", record.id)
          .update({
            ...record,
            size: file.size,
            modified_at: file.modifiedAt.toISOString(),
          })
          .execute();
      }

      return record;
    } else {
      const record = {
        id: uuid.generate(),
        ["modified_at"]: file.modifiedAt
          ? file.modifiedAt.toISOString()
          : undefined,
        name: file.name,
        path: file.path,
        ["file_set_id"]: this.id,
        size: file.size,
      };

      await this.db.table("file").insert(record).execute();

      return record;
    }
  }
}
