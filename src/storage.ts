import { DB, type QueryParameter } from "sqlite";
import { ensureFile } from "fs";
import * as log from "log";

export { DB, QueryParameter };

async function buildDatabase(dbPath: string): Promise<DB> {
  await ensureFile(dbPath);

  const db = new DB(dbPath);

  if (!(await Deno.stat(dbPath)).size) {
    log.debug(`Initialize database`);

    await Promise.all(
      `
        CREATE TABLE folders (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT, created_at NUMBER, modified_at NUMBER);
        CREATE TABLE files (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, path TEXT, size INTEGER, last_modified NUMBER, created_at NUMBER, modified_at NUMBER, folder_id INTEGER);
        CREATE UNIQUE INDEX uq_folder IF NOT EXISTS ON folders (path);
        CREATE UNIQUE INDEX uq_file IF NOT EXISTS ON files (path,folder_id);
        `
        .split(";")
        .map((ele) => ele.trim())
        .map((ele) => db.query(ele)),
    );

    log.debug(`Initialize database finish`);
  }

  return db;
}

let currentDatabase: DB | null = null;
let dryRunFlag = false;

export async function withDatabase<T>(
  dbPath: string,
  callable: (database: DB) => Promise<T>,
  dryRun?: boolean,
): Promise<T> {
  const database = await buildDatabase(dbPath);

  log.debug(`Begin transaction`);
  dryRunFlag = !!dryRun;

  database.query("BEGIN");
  currentDatabase = database;

  try {
    const result = await callable(database);

    log.debug(`Commit transaction`);
    database.query("COMMIT");
    return result;
  } catch (e) {
    log.debug(`Rollback transaction`);

    database.query("ROLLBACK");
    throw e;
  } finally {
    database.close(true);
    currentDatabase = null;
    dryRunFlag = false;
  }
}

export function getDatabase() {
  if (currentDatabase == null) {
    throw new Error("Database is not ready, please use withDatabase first.");
  }

  return currentDatabase;
}

export function isDryRun() {
  return dryRunFlag;
}
