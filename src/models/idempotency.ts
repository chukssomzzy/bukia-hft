import { Column, Entity } from "typeorm";

import ExtendedBaseEntity from "./extended-base-entity";

@Entity({ name: "idempotency" })
export class Idempotency extends ExtendedBaseEntity {
  @Column({ unique: true })
  key: string;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ nullable: true, type: "json" })
  response?: null | Record<string, unknown>;

  @Column({ default: "pending" })
  status: "completed" | "failed" | "pending" | "processing";
}
