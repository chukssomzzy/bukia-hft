import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";

import ExtendedBaseEntity from "./extended-base-entity";
import { Wallet } from "./wallet";

@Entity({ name: "transfer" })
export class Transfer extends ExtendedBaseEntity {
  @Column({ type: "numeric" })
  amount: string;

  @JoinColumn({ name: "fromWalletId" })
  @ManyToOne(() => Wallet, { nullable: false })
  fromWallet: Wallet;

  @Column()
  fromWalletId: number;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @Column({ nullable: true, type: "json" })
  metadata?: Record<string, unknown>;

  @JoinColumn({ name: "toWalletId" })
  @ManyToOne(() => Wallet, { nullable: false })
  toWallet: Wallet;

  @Column()
  toWalletId: number;

  @Column({ nullable: true })
  txId?: string;
}
