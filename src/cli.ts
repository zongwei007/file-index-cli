import Denomander from "https://deno.land/x/denomander/mod.ts";
import osPaths from "https://deno.land/x/os_paths@v6.9.0/src/mod.deno.ts";
import { join } from "https://deno.land/std@0.89.0/path/mod.ts";

import add from "./add.ts";
import search from "./search.ts";

const defaultDatabasePath = join(
  osPaths.home() || ".",
  ".file-index/database.db"
);

const program = new Denomander({
  app_name: "File Index CLI",
  app_description: "简易文件索引命令",
  app_version: "1.0.0",
});

program
  .command("add [src]")
  .description("添加路径到索引数据库")
  .option("--dry-run", "空运行，不操作数据库")
  .action((args: { src: string }) =>
    add({
      database: program.database || defaultDatabasePath,
      dryRun: "dry-run" in program,
      verbose: "verbose" in program,
      ...args,
    })
  );

program
  .command("search [key]")
  .description("按关键字在数据库中检索文件")
  .action((args: { key: string }) => {
    search({
      database: program.database || defaultDatabasePath,
      ...args,
    });
  });

program.globalOption(
  "-db, --database",
  "索引数据库存储路径，默认为：~/.file-index/database.db"
);

program.globalOption("--verbose", "输出调试信息");

export default program;
