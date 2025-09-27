import { Job, JobsOptions, Queue } from "bullmq";
import { EntityManager } from "typeorm";

import config from "../config";
import { BadRequest } from "../middleware";
import { Wallet } from "../models";
import {
  IdempotencyRepository,
  LedgerRepository,
  TransferRepository,
  WalletRepository,
} from "../repositories";
import { UserRepository } from "../repositories/user.repository";
import { TransferRequestType } from "../schema/transfer.schema";
import { Transactional } from "../utils/db";
import {
  currencyConversionService,
  CurrencyConversionService,
} from "./currency-convertion.services";
import { emailService } from "./email.services";
import { RedisService } from "./redis.services";

const connection = RedisService.duplicate();

export class OptimisticLockError extends Error {}
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export class TransferServices {
  private currencyConversionService: CurrencyConversionService;
  private queue: Queue<TransferRequestType, void, string>;

  constructor(currencyConversionService: CurrencyConversionService) {
    this.queue = new Queue<TransferRequestType, void, string>("transfers", {
      connection,
    });
    this.currencyConversionService = currencyConversionService;
  }
  public async enqueueTransfer(
    payload: TransferRequestType & { userId: number },
    options?: JobsOptions,
  ): Promise<Job<TransferRequestType, void, string>> {
    const fromWallet = await WalletRepository.findById(payload.fromWalletId);
    if (!fromWallet || fromWallet.userId !== payload.userId)
      throw new BadRequest("User is not the owner of wallet");

    if (
      (await WalletRepository.getBalance(payload.fromWalletId)) < payload.amount
    )
      throw new BadRequest("Insufficient funds");

    payload.currency = fromWallet.currency;
    await this.handleIdempotencyForEnqueue(payload);

    return await this.addTransferJob(payload, options);
  }
  public async process(payload: TransferRequestType & { userId: number }) {
    const maxRetries = config.TRANSFER_OPTIMISTIC_RETRIES;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const trx = await this.executeTransaction(payload);
        await this.sendTransferStatusEmail(
          payload,
          "completed",
          "",
          trx.transferId,
        );
        return trx;
      } catch (err) {
        if (err instanceof PermanentError) {
          await IdempotencyRepository.markAsFailed(
            payload.idempotencyKey,
            err.message,
          );
          await this.sendTransferStatusEmail(payload, "failed", err.message);
          return { transferId: null };
        }

        if (this.shouldRetryOptimisticLock(err, attempt, maxRetries)) {
          attempt++;
          await this.backoff(attempt);
          continue;
        }

        if (this.isDuplicateKeyError(err)) {
          const reconciled = await this.reconcile(payload.idempotencyKey);
          if (reconciled?.transferId)
            await this.sendTransferStatusEmail(
              payload,
              "completed",
              "",
              reconciled.transferId,
            );

          return reconciled ?? { transferId: null };
        }

        throw err;
      }
    }

    return { transferId: null };
  }

  public async sendTransferStatusEmail(
    payload: TransferRequestType & { userId: number },
    status: "completed" | "failed" | "pending",
    reason?: string,
    txId?: string,
  ) {
    const sender = await UserRepository.findWithProfile({
      where: { id: payload.userId },
    });
    await emailService.send(
      sender.email,
      "user.transfer-status",
      {
        amount: payload?.amount,
        currency: payload?.currency,
        firstName: sender?.profile?.firstName,
        fromWalletId: payload?.fromWalletId,
        reason,
        status,
        toWalletId: payload?.toWalletId,
        txId,
      },
      "Transfer " + status,
    );

    if (status === "completed") {
      const recipient = await WalletRepository.findUserByWallet(
        payload.toWalletId,
      );
      if (recipient && recipient?.email) {
        await emailService.send(
          recipient?.email,
          "user.transfer-received",
          {
            amount: payload?.amount,
            currency: payload?.currency,
            firstName: recipient?.profile?.firstName,
            fromName: sender?.profile?.firstName,
            toWalletId: payload?.toWalletId,
            txId,
          },
          "Transfer received to your wallet",
        );
      }
    }
  }

  private async addTransferJob(
    payload: TransferRequestType,
    options?: JobsOptions,
  ): Promise<Job<TransferRequestType, void, string>> {
    const defaultOptions = {
      attempts: config.TRANSFER_RETRY_LIMIT,
      backoff: {
        delay: config.TRANSFER_BACKOFF_MS,
        type: "exponential",
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    return await this.queue.add("transfer", payload, {
      ...defaultOptions,
      ...(options ?? {}),
    });
  }

  private async assertUserOwnsWallet(
    userId: number,
    walletId: number,
    manager: EntityManager,
  ): Promise<void> {
    const wallet = await WalletRepository.findById(walletId, manager);
    if (!wallet || wallet.userId !== userId) {
      throw new PermanentError("User is not the owner of the source wallet");
    }
  }

  private async backoff(attempt: number): Promise<void> {
    const backoffMs = 100 * Math.pow(2, attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  private async checkExistingTransactions(
    idempotencyKey: string,
    manager: EntityManager,
  ) {
    const existingTransfer = await TransferRepository.findByIdempotencyKey(
      idempotencyKey,
      manager,
    );
    if (existingTransfer) {
      await IdempotencyRepository.markCompleted(
        idempotencyKey,
        { transferId: existingTransfer.id },
        manager,
      );
      return { transferId: existingTransfer.id };
    }

    const existingLedger = await LedgerRepository.findByIdempotencyKey(
      idempotencyKey,
      manager,
    );
    if (existingLedger) {
      await IdempotencyRepository.markCompleted(
        idempotencyKey,
        { transferId: null },
        manager,
      );
      return { transferId: null };
    }

    await IdempotencyRepository.createRecord(idempotencyKey, manager);
    return null;
  }

  private async createLedgerEntries(
    payload: TransferRequestType & { creditAmount?: number | string },
    manager: EntityManager,
  ) {
    try {
      await LedgerRepository.createTransferEntries(
        {
          amount: payload.amount,
          creditAmount: payload.creditAmount,
          fromWalletId: payload.fromWalletId,
          idempotencyKey: payload.idempotencyKey,
          metadata: payload.metadata,
          toWalletId: payload.toWalletId,
          txId: payload.txId,
        },
        manager,
      );
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        const reconciled = await this.reconcile(payload.idempotencyKey);
        if (reconciled) return reconciled;
      }
      throw err;
    }
  }

  private async createTransferRecord(
    payload: TransferRequestType,
    manager: EntityManager,
  ) {
    return await TransferRepository.createTransfer(
      {
        amount: payload.amount,
        fromWalletId: payload.fromWalletId,
        idempotencyKey: payload.idempotencyKey,
        metadata: payload.metadata,
        toWalletId: payload.toWalletId,
        txId: payload.txId,
      },
      manager,
    );
  }

  @Transactional()
  private async executeTransaction(
    payload: TransferRequestType & {
      creditAmount?: number | string;
      userId: number;
    },
    manager?: EntityManager,
  ) {
    const idempotencyKey = payload.idempotencyKey;
    if (!idempotencyKey) throw new PermanentError("idempotencyKey required");

    await this.processIdempotencyRecord(idempotencyKey, manager!);

    const existingResult = await this.checkExistingTransactions(
      idempotencyKey,
      manager!,
    );

    if (existingResult) return existingResult;

    await this.validateTransferRequest(payload, manager!);

    const wallets = await this.getWallets(
      payload.fromWalletId,
      payload.toWalletId,
      manager!,
    );

    payload.creditAmount = await this.getCreditAmount(payload, wallets);
    await this.createLedgerEntries(payload, manager!);

    const savedTransfer = await this.createTransferRecord(payload, manager!);

    await this.updateWalletVersions(wallets.from, wallets.to, manager!);

    await IdempotencyRepository.markCompleted(
      idempotencyKey,
      { transferId: savedTransfer.id },
      manager,
    );

    return { transferId: savedTransfer.id };
  }

  private async getCreditAmount(
    payload: TransferRequestType,
    wallets: { from: Wallet; to: Wallet },
  ) {
    const fromCurrency = wallets.from.currency;
    const toCurrency = wallets.to.currency;
    if (fromCurrency === toCurrency) return payload.amount;
    return await this.currencyConversionService.convert(
      Number(payload.amount),
      fromCurrency,
      toCurrency,
    );
  }

  private async getWallets(
    fromWalletId: number,
    toWalletId: number,
    manager: EntityManager,
  ) {
    const [fromWallet, toWallet] = await Promise.all([
      WalletRepository.findById(fromWalletId, manager),
      WalletRepository.findById(toWalletId, manager),
    ]);

    if (!fromWallet || !toWallet) {
      throw new Error("Wallet not found");
    }

    return { from: fromWallet, to: toWallet };
  }

  private async handleIdempotencyForEnqueue(payload: TransferRequestType) {
    if (!payload.idempotencyKey) return;

    const existing = await IdempotencyRepository.findByKey(
      payload.idempotencyKey,
    );

    if (existing) {
      if (existing.status === "completed")
        throw new Error("Idempotency key already processed");

      if (existing.status == "processing")
        throw new Error("Transfer is already being processed");

      if (existing.status == "failed")
        throw new Error("Previous transfer failed, cannot enqueue");
    } else {
      await IdempotencyRepository.createRecord(payload.idempotencyKey);
    }
  }

  private isDuplicateKeyError(err): boolean {
    const code = err?.code ?? err?.driverError?.code;
    return code === "23505" || /duplicate key value/.test(String(err));
  }

  private async processIdempotencyRecord(
    idempotencyKey: string,
    manager: EntityManager,
  ) {
    const updateRes = await IdempotencyRepository.markProcessingRecord(
      idempotencyKey,
      manager,
    );

    if (updateRes.affected === 0) {
      const existing = await IdempotencyRepository.findByKey(
        idempotencyKey,
        manager,
      );
      if (existing?.status === "completed") {
        return existing.response ?? null;
      }
      throw new Error("idempotency record not pending");
    }
  }

  private async reconcile(idempotencyKey?: null | string) {
    if (!idempotencyKey) return null;

    const transfer =
      await TransferRepository.findByIdempotencyKey(idempotencyKey);
    if (transfer) {
      await IdempotencyRepository.markCompleted(idempotencyKey, {
        transferId: transfer.id,
      });
      return { transferId: transfer.id };
    }

    const ledger = await LedgerRepository.findByIdempotencyKey(idempotencyKey);
    if (ledger) {
      await IdempotencyRepository.markCompleted(idempotencyKey, {
        transferId: null,
      });
      return { transferId: null };
    }

    return null;
  }

  private shouldRetryOptimisticLock(
    err: unknown,
    attempt: number,
    max: number,
  ): boolean {
    return err instanceof OptimisticLockError && attempt < max;
  }
  private async updateWalletVersions(
    fromWallet: Wallet,
    toWallet: Wallet,
    manager: EntityManager,
  ) {
    const fromVersion = fromWallet.version ?? 0;
    const toVersion = toWallet.version ?? 0;

    const [updatedFrom, updatedTo] = await Promise.all([
      WalletRepository.incrementVersionIfMatch(
        fromWallet.id,
        fromVersion,
        manager,
      ),
      WalletRepository.incrementVersionIfMatch(toWallet.id, toVersion, manager),
    ]);

    if (updatedFrom === 0) {
      throw new OptimisticLockError("Optimistic lock failed for fromWallet");
    }

    if (updatedTo === 0) {
      throw new OptimisticLockError("Optimistic lock failed for toWallet");
    }
  }

  private async validateTransferRequest(
    payload: TransferRequestType & { userId: number },
    manager: EntityManager,
  ) {
    const { amount: amountStr, fromWalletId } = payload;

    await this.assertUserOwnsWallet(
      payload.userId,
      payload.fromWalletId,
      manager,
    );

    const fromBalanceStr = await LedgerRepository.getBalanceForWallet(
      fromWalletId,
      manager,
    );
    const numericFrom = parseFloat(String(fromBalanceStr));
    const numericAmount = parseFloat(String(amountStr));

    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new PermanentError("Invalid amount");
    }

    if (numericFrom < numericAmount) {
      throw new PermanentError("Insufficient funds");
    }
  }
}

export const transferService = new TransferServices(currencyConversionService);
