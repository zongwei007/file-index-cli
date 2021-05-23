import { format } from "datetime";
import cliFormat from "cli-format";

import type { Column } from "cli-format";

export type TableColumn = {
  name: string;
  width?: number;
  options?: Column;
  align?: "left" | "right";
};

export function printTable<
  T extends Record<string, string | number | boolean | Date>
>(columns: TableColumn[], data: T[]) {
  const { columns: screenWidth } = Deno.consoleSize(Deno.stdout.rid);

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

  console.log(new Array(screenWidth).fill("─").join(""));

  data.forEach((row, index, array) => {
    console.log(
      cliFormat.columns.wrap(
        columns.map((column) => mapper(column, row)),
        {
          width: screenWidth,
          paddingMiddle: " | ",
        }
      )
    );

    if (index < array.length - 1) {
      console.log(lineSeparator);
    }
  });

  console.log(new Array(screenWidth).fill("─").join(""));
}
