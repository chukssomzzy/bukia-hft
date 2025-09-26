import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";

import ExtendedBaseEntity from "./extended-base-entity";
import { Wallet } from "./wallet";

export type LedgerEntryType = "credit" | "debit";

@Entity({ name: "ledger_entry" })
export class LedgerEntry extends ExtendedBaseEntity {
  @Column({ type: "numeric" })
  amount: string;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @Column({ nullable: true, type: "json" })
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  txId?: string;

  @Column({ type: "character varying" })
  type: LedgerEntryType;

  @JoinColumn({ name: "walletId" })
  @ManyToOne(() => Wallet, (wallet) => wallet.id, { nullable: false })
  wallet: Wallet;

  @Column()
  walletId: number;
}
