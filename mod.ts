import * as log from "log";

import cli from "./src/cli.ts";

cli.on("option:verbose", () => {
  log.setup({
    handlers: {
      console: new log.handlers.ConsoleHandler("DEBUG"),
    },
    loggers: {
      default: {
        level: "DEBUG",
        handlers: ["console"],
      },
    },
  });
});

cli.parse(Deno.args);
