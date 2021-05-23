import { Command } from "cmd";
import { join } from "path";
import osPaths from "os_paths";

import * as folders from "./command/folders.ts";
import * as files from "./command/files.ts";
import { withDatabase } from "./storage.ts";

const defaultDatabasePath = join(
  osPaths.home() || ".",
  ".file-index/database.db"
);

const program = new Command();

program.name("file-index").version("1.0.0");

const folder: Command = program
  .command("folder")
  .description("管理已索引的根目录");

folder
  .command("index <path>")
  .alias("add")
  .description("创建或更新目录索引")
  .action((path: string) => {
    const { database, dryRun, ...opts } = program.opts();

    return withDatabase(
      database,
      () => folders.index({ ...opts, path }),
      dryRun
    );
  });

folder
  .command("list")
  .alias("ls")
  .description("查看已索引的根目录")
  .option("-f, --filter <path>", "按路径过滤")
  .action((args: Command) => {
    const { database, ...opts } = program.opts();

    return withDatabase(database, () =>
      folders.list({ ...opts, key: args.path })
    );
  });

folder
  .command("diff <src> <target>")
  .description("比较目录差异")
  .option("-t, --type <type>", "筛选差异类型")
  .action((src: string, target: string, args: Command) => {
    const { database, ...opts } = program.opts();

    return withDatabase(database, () =>
      folders.diff({ ...opts, src, target, type: args.type })
    );
  });

folder
  .command("move <src> <target>")
  .alias("mv")
  .description("移动根目录路径")
  .action((src: string, target: string) => {
    const { database, dryRun, ...opts } = program.opts();

    return withDatabase(
      database,
      () => folders.move({ ...opts, src, target }),
      dryRun
    );
  });

program
  .command("search [keywords...]")
  .description("按关键字检索文件")
  .action((keywords: string) => {
    const { database, ...opts } = program.opts();

    return withDatabase(database, () => files.search({ ...opts, keywords }));
  });

program.option(
  "-db, --database <database>",
  "索引数据库存储路径",
  (v: string) => v,
  defaultDatabasePath
);

program.option("--verbose", "输出调试信息");

program.option("--dry-run", "空运行，不写入数据库");

export default program;
