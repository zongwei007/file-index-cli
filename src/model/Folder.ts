import {
  BaseModel,
  Column,
  DataType,
  HasMany,
  Model,
  Primary,
} from "https://deno.land/x/cotton@v0.7.5/mod.ts";

import File from "./File.ts";

@Model("folders")
class Folder extends BaseModel {
  @Primary()
  id!: number;

  @Column()
  path!: string;

  @HasMany(() => File, "folder_id")
  files?: File[];

  @Column({ name: "created_at", default: () => Date.now() })
  createdAt!: number;

  @Column({ name: "modified_at", default: () => Date.now() })
  modifiedAt?: number;
}

export default Folder;
