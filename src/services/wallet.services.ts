import { EntityManager } from "typeorm";

import { Conflict } from "../middleware";
import { User, Wallet } from "../models";
import { WalletRepository } from "../repositories/wallet.repository";
import { WalletListResponseType } from "../schema/wallet.schema";

export class WalletServices {
  public async createAndSaveDefaultWalletsForUser(
    user: User,
    manager: EntityManager,
  ): Promise<Wallet[]> {
    const repo = manager.getRepository(Wallet);
    const currencies = getDefaultCurrenciesForCountry(user.country);
    const created: Wallet[] = [];

    for (const currency of currencies) {
      const wallet = repo.create({
        currency,
        isDefault: true,
        user: user,
        userId: user.id,
      });
      await repo.save(wallet);
      created.push(wallet);
    }

    user.wallets = created;
    await manager.save(user);

    return created;
  }

  public async createWallet(
    userId: number,
    currency: string,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const repo = manager ? manager.getRepository(Wallet) : WalletRepository;
    const existing = await repo.findOne({ where: { currency, userId } });
    if (existing) throw new Conflict("Wallet already exists for this currency");
    const wallet = repo.create({
      currency: currency.toUpperCase(),
      isDefault: false,
      userId,
    });
    await repo.save(wallet);
    return wallet;
  }

  public async getWalletsForUser(userId: number): Promise<WalletListResponseType> {
    return WalletRepository.getWalletsForUser(userId) as unknown as WalletListResponseType;
  }
}

const COUNTRY_DEFAULTS: Record<string, string[]> = {
  EU: ["EUR", "USD"],
  NG: ["NGN", "USD"],
  UK: ["GBP", "USD"],
  US: ["USD"],
};

function getDefaultCurrenciesForCountry(country: string) {
  const up = (country || "").toUpperCase();
  return COUNTRY_DEFAULTS[up] ?? ["USD"];
}

export const walletService = new WalletServices();
