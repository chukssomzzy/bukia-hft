import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";

import ExtendedBaseEntity from "./extended-base-entity";
import { User } from "./user";

@Entity()
export class Wallet extends ExtendedBaseEntity {
  @Column({ nullable: false })
  currency: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ nullable: true, type: "json" })
  metadata?: Record<string, unknown>;

  @JoinColumn({ name: "userId" })
  @ManyToOne(() => User, (user) => user.id, { nullable: false })
  user: User;

  @Column()
  userId: number;

  @Column({ default: 0 })
  version: number;
}
