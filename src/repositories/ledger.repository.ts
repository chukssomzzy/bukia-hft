import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { LedgerEntry } from "../models";

export interface LedgerBreakdownRow {
  count: number;
  total: string;
  type: string;
}

export const LedgerRepository = AppDataSource.getRepository(LedgerEntry).extend(
  {
    async createEntry(entity: Partial<LedgerEntry>, manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      return repo.save(repo.create(entity));
    },

    async createTransferEntries(
      params: {
        amount: string;
        creditAmount?: number | string;
        fromWalletId: number;
        idempotencyKey: string;
        metadata?: Record<string, unknown> | undefined;
        toWalletId: number;
        txId?: string | undefined;
      },
      manager?: EntityManager,
    ) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;

      await repo
        .createQueryBuilder()
        .insert()
        .values([
          {
            amount: params.amount,
            idempotencyKey: params.idempotencyKey,
            metadata: params.metadata,
            txId: params.txId,
            type: "debit",
            walletId: params.fromWalletId,
          },
          {
            amount: params.creditAmount,
            idempotencyKey: params.idempotencyKey,
            metadata: params.metadata,
            txId: params.txId,
            type: "credit",
            walletId: params.toWalletId,
          },
        ])
        .execute();

      const debit = await repo.findOne({
        where: { idempotencyKey: params.idempotencyKey, type: "debit" },
      });
      const credit = await repo.findOne({
        where: { idempotencyKey: params.idempotencyKey, type: "credit" },
      });

      return { credit, debit };
    },

    async findByIdempotencyKey(key: string, manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      return repo.findOne({ where: { idempotencyKey: key } });
    },

    async getBalanceForWallet(walletId: number, manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("ledger_entry")
        .select(
          "COALESCE(SUM(CASE WHEN ledger_entry.type = 'credit' THEN ledger_entry.amount ELSE -ledger_entry.amount END), 0)",
          "balance",
        )
        .where("ledger_entry.walletId = :walletId", { walletId })
        .getRawOne();

      return res?.balance ?? "0";
    },

    async getCreditsDebitsBreakdownByCurrencyForUser(
      userId: number,
      manager?: EntityManager,
    ) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("l.type", "type")
        .addSelect("w.currency", "currency")
        .addSelect("COUNT(l.id)", "count")
        .addSelect("COALESCE(SUM(l.amount),0)", "total")
        .innerJoin("wallet", "w", 'w.id = l."walletId"')
        .where('w."userId" = :userId', { userId })
        .groupBy("l.type")
        .addGroupBy("w.currency")
        .getRawMany();

      return (
        res as Array<{
          count: string;
          currency: string;
          total: string;
          type: string;
        }>
      ).map((r) => ({
        count: Number(r.count ?? 0),
        currency: r.currency,
        total: r.total ?? "0",
        type: r.type,
      }));
    },

    async getCreditsDebitsBreakdownForUser(
      userId: number,
      manager?: EntityManager,
    ) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("l.type", "type")
        .addSelect("COUNT(l.id)", "count")
        .addSelect("COALESCE(SUM(l.amount),0)", "total")
        .innerJoin("wallet", "w", 'w.id = l."walletId"')
        .where('w."userId" = :userId', { userId })
        .groupBy("l.type")
        .getRawMany();

      return (res as Array<{ count: string; total: string; type: string }>).map(
        (r) => ({
          count: Number(r.count ?? 0),
          total: r.total ?? "0",
          type: r.type,
        }),
      );
    },

    async getEntriesForUser(
      userId: number,
      page: number = 1,
      pageSize: number = 10,
      sort: string,
      manager?: EntityManager,
    ) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const qb = repo
        .createQueryBuilder("l")
        .leftJoinAndSelect("l.wallet", "w")
        .where('w."userId" = :userId', { userId })
        .orderBy("l.createdAt", sort)
        .skip((page - 1) * pageSize)
        .take(pageSize);

      const [items, total] = await qb.getManyAndCount();

      return { items, page, pageSize, total };
    },

    async getLargestByCurrencyForUser(userId: number, manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("MAX(l.amount)", "max")
        .addSelect("w.currency", "currency")
        .innerJoin("wallet", "w", 'w.id = l."walletId"')
        .where('w."userId" = :userId', { userId })
        .groupBy("w.currency")
        .getRawMany();

      return (res as Array<{ currency: string; max: string }>).map((r) => ({
        currency: r.currency,
        max: r.max ?? "0",
      }));
    },

    async getLargestTransferForUser(userId: number, manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("MAX(l.amount)", "max")
        .innerJoin("wallet", "w", 'w.id = l."walletId"')
        .where('w."userId" = :userId', { userId })
        .getRawOne();
      return res?.max ?? "0";
    },

    async getTotalTransferCount(manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("COUNT(l.id)", "count")
        .where("l.type = :type", { type: "debit" })
        .getRawOne();
      return Number(res?.count ?? 0);
    },

    async getTotalTransfersByCurrency(manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("w.currency", "currency")
        .addSelect("COUNT(l.id)", "count")
        .addSelect("COALESCE(SUM(l.amount),0)", "total")
        .innerJoin("wallet", "w", 'w.id = l."walletId"')
        .where("l.type = :type", { type: "debit" })
        .groupBy("w.currency")
        .getRawMany();

      return (
        res as Array<{ count: string; currency: string; total: string }>
      ).map((r) => ({
        count: Number(r.count ?? 0),
        currency: r.currency,
        total: r.total ?? "0",
      }));
    },

    async getTransactionCountForUser(userId: number, manager?: EntityManager) {
      const repo = manager ? manager.getRepository(LedgerEntry) : this;
      const res = await repo
        .createQueryBuilder("l")
        .select("COUNT(l.id)", "count")
        .innerJoin("wallet", "w", 'w.id = l."walletId"')
        .where('w."userId" = :userId', { userId })
        .getRawOne();
      return Number(res?.count ?? 0);
    },
  },
);
