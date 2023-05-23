import { format } from "datetime";
import cliFormat from "cli-format";

import type { Column } from "cli-format";

type TableRow = Record<string, string | number | boolean | Date>;

export type TableColumn = {
  name: string;
  width?: number;
  options?: Column;
  align?: "left" | "right";
};

export function printTable<T extends TableRow>(
  columns: TableColumn[],
  data: T[],
  println: (text: string) => void,
) {
  const { columns: screenWidth } = Deno.consoleSize();

  const mapper = (column: TableColumn, row: T): Column => {
    let content = row[column.name];

    if (content instanceof Date) {
      content = format(content, "yyyy-MM-dd HH:mm:ss");
    } else {
      content = String(content);
    }

    if (column.align === "right" && column.width) {
      content = content.padStart(column.width, " ");
    }

    return {
      content,
      width: column.width,
      ...column.options,
    };
  };

  const lineSeparator = new Array(screenWidth).fill("-").join("");

  println(new Array(screenWidth).fill("─").join(""));

  data.forEach((row, index, array) => {
    println(
      cliFormat.columns.wrap(
        columns.map((column) => mapper(column, row)),
        {
          width: screenWidth,
          paddingMiddle: " | ",
        },
      ),
    );

    if (index < array.length - 1) {
      println(lineSeparator);
    }
  });

  println(new Array(screenWidth).fill("─").join(""));
}

export function printResult<T extends TableRow>(
  columns: TableColumn[],
  rows: T[] | Record<string, T[]>,
  { format, output }: { format?: "table" | "json"; output?: string },
) {
  let println = console.log;

  if (output) {
    Deno.writeTextFileSync(output, "");

    println = (text: string) =>
      Deno.writeTextFileSync(output, text, { append: true });
  }

  if (format === "json") {
    println(JSON.stringify(rows));
  } else if (Array.isArray(rows)) {
    printTable(columns, rows, println);
  } else {
    Object.entries(rows).forEach(([key, children]) => {
      println(key);

      printTable(columns, children, println);

      println(`total: ${children.length}`);
      println("");
    });
  }

  return Promise.resolve();
}
