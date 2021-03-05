import {
  BaseModel,
  BelongsTo,
  Column,
  DataType,
  Model,
  Primary,
} from "https://deno.land/x/cotton@v0.7.5/mod.ts";

import Folder from "./Folder.ts";

@Model("files")
class File extends BaseModel {
  @Primary()
  id!: number;

  @Column()
  name!: string;

  @Column()
  path!: string;

  @Column()
  size!: number;

  @BelongsTo(() => Folder, "folder_id")
  folder!: Folder;

  @Column({ name: "created_at", default: () => Date.now() })
  createdAt!: number;

  @Column({ name: "last_modified" })
  lastModified?: number;
}

export default File;
