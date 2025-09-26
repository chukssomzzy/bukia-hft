import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { Wallet } from "../models";

export const WalletRepository = AppDataSource.getRepository(Wallet).extend({
  async create(
    entityLike: Partial<Wallet>,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const repo = manager ? manager.getRepository(Wallet) : this;
    return repo.create(entityLike);
  },

  async findById(id: number, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Wallet) : this;
    return repo.findOne({ where: { id } });
  },
  async findByUserAndCurrency(userId: number, currency: string) {
    return this.findOne({ where: { currency, userId } });
  },
  async findUserByWallet(walletId: number, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Wallet) : this;
    const wallet = await repo.findOne({
      relations: ["user", "user.profile"],
      where: { id: walletId },
    });
    return wallet?.user ?? null;
  },

  async getBalance(walletId: number) {
    const res = await AppDataSource.getRepository("ledger_entry")
      .createQueryBuilder("ledger_entry")
      .select(
        "COALESCE(SUM(CASE WHEN ledger_entry.type = 'credit' THEN ledger_entry.amount ELSE -ledger_entry.amount END), 0)",
        "balance",
      )
      .where("ledger_entry.walletId = :walletId", { walletId })
      .getRawOne();
    return res?.balance ?? "0";
  },

  async getWalletsForUser(userId: number) {
    const wallets = await this.find({ where: { userId } });
    const ledgerRepo = AppDataSource.getRepository("ledger_entry");
    const results = await Promise.all(
      wallets.map(async (w: Partial<Wallet>) => {
        const res = await ledgerRepo
          .createQueryBuilder("ledger_entry")
          .select(
            "COALESCE(SUM(CASE WHEN ledger_entry.type = 'credit' THEN ledger_entry.amount ELSE -ledger_entry.amount END), 0)",
            "balance",
          )
          .where("ledger_entry.walletId = :walletId", { walletId: w.id })
          .getRawOne();
        return {
          balance: res?.balance ?? "0",
          createdAt: w.createdAt,
          currency: w.currency,
          id: w.id,
          isDefault: w.isDefault,
          metadata: w.metadata,
          updatedAt: w.updatedAt,
          userId: w.userId,
          version: w.version,
        };
      }),
    );
    return results;
  },

  async incrementVersionIfMatch(
    id: number,
    expectedVersion: number,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Wallet) : this;
    const res = await repo
      .createQueryBuilder()
      .update()
      .set({ version: () => "version + 1" })
      .where("id = :id AND version = :version", {
        id,
        version: expectedVersion,
      })
      .execute();
    return res.affected ?? 0;
  },
});
