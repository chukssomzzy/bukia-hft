import EventEmitter from "events";

import type { TransferRequestType } from "../../schema/transfer.schema";
import type { CurrencyConversionService } from "../../services/currency-convertion.services";

import { IdempotencyRepository } from "../../repositories/idempotency.repository";
import { WalletRepository } from "../../repositories/wallet.repository";
import { TransferServices } from "../../services/transfer.services";

interface ProtoWithAdd {
  addTransferJob(
    payload: TransferRequestType,
    options?: unknown,
  ): Promise<unknown>;
}

jest.mock("../../repositories/wallet.repository", () => ({
  WalletRepository: {
    findById: jest.fn(),
    getBalance: jest.fn(),
  },
}));

jest.mock("../../repositories/idempotency.repository", () => ({
  IdempotencyRepository: {
    createRecord: jest.fn(),
    findByKey: jest.fn(),
    markAsFailed: jest.fn(),
    markCompleted: jest.fn(),
    markProcessingRecord: jest.fn().mockResolvedValue({ affected: 1 }),
  },
}));

jest.mock("bullmq", () => {
  class FakeQueue {
    add(_name: string, _payload: unknown, _opts?: unknown) {
      return Promise.resolve({ id: "job" });
    }
  }
  return { Queue: FakeQueue };
});

jest.mock("../../services/email.services", () => ({
  emailService: { send: jest.fn() },
}));

jest.mock("../../config", () => ({
  default: {
    TRANSFER_BACKOFF_MS: 1,
    TRANSFER_OPTIMISTIC_RETRIES: 1,
    TRANSFER_RETRY_LIMIT: 1,
  },
}));

jest.mock("../../services/redis.services", () => ({
  RedisService: {
    duplicate: jest.fn().mockImplementation(() => new EventEmitter()),
  },
}));

jest.mock("../../utils/db", () => ({
  Transactional:
    () =>
    <T extends (...args: unknown[]) => Promise<unknown>>(
      _target: object,
      _propertyKey: string | symbol,
      _descriptor: TypedPropertyDescriptor<T>,
    ): void => {
      return;
    },
}));

describe("TransferServices", () => {
  describe("enqueueTransfer", () => {
    let svc: TransferServices;
    const payloadBase = {
      amount: "100",
      currency: "USD",
      fromWalletId: 1,
      idempotencyKey: "idem-key",
      metadata: {},
      toWalletId: 2,
      txId: "tx-1",
      userId: 10,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      const fakeConv: CurrencyConversionService = {
        convert: async () => 1,
        getRate: async () => 1,
      } as unknown as CurrencyConversionService;
      svc = new TransferServices(fakeConv);
    });

    it("throws when user does not own wallet and calls WalletRepository.findById with fromWalletId", async () => {
      (WalletRepository.findById as jest.Mock).mockResolvedValue({ userId: 2 });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "User is not the owner of wallet",
      );
      expect(WalletRepository.findById).toHaveBeenCalledWith(
        payloadBase.fromWalletId,
      );
    });

    it("throws when insufficient funds and calls WalletRepository.getBalance with fromWalletId", async () => {
      (WalletRepository.findById as jest.Mock).mockResolvedValue({
        userId: payloadBase.userId,
      });
      (WalletRepository.getBalance as jest.Mock).mockResolvedValue(50);
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Insufficient funds",
      );
      expect(WalletRepository.getBalance).toHaveBeenCalledWith(
        payloadBase.fromWalletId,
      );
    });

    it("handles idempotency states and creates record when none exists then enqueues", async () => {
      (WalletRepository.findById as jest.Mock).mockResolvedValue({
        userId: payloadBase.userId,
      });
      (WalletRepository.getBalance as jest.Mock).mockResolvedValue("200");

      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({
        status: "completed",
      });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Idempotency key already processed",
      );

      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({
        status: "processing",
      });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Transfer is already being processed",
      );

      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({
        status: "failed",
      });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Previous transfer failed, cannot enqueue",
      );

      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (IdempotencyRepository.createRecord as jest.Mock).mockResolvedValue(
        undefined,
      );

      const fakeJob = { id: "job-1" };
      const proto = TransferServices.prototype as unknown as Record<
        string,
        unknown
      >;
      const originalAdd = proto.addTransferJob;
      const addSpy = jest.fn().mockResolvedValue(fakeJob);
      proto.addTransferJob = addSpy;

      await svc.enqueueTransfer({ ...payloadBase });
      expect(IdempotencyRepository.createRecord).toHaveBeenCalledWith(
        payloadBase.idempotencyKey,
      );
      expect(addSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: payloadBase.amount,
          fromWalletId: payloadBase.fromWalletId,
          toWalletId: payloadBase.toWalletId,
        }),
        undefined,
      );
      proto.addTransferJob = originalAdd;
    });

    it("does not touch idempotency when no idempotencyKey provided and enqueues", async () => {
      const payload = {
        ...payloadBase,
        idempotencyKey: undefined,
      } as TransferRequestType & { userId: number };
      (WalletRepository.findById as jest.Mock).mockResolvedValue({
        userId: payload.userId,
      });
      (WalletRepository.getBalance as jest.Mock).mockResolvedValue("200");
      const fakeJob = { id: "job-2" };

      const proto = TransferServices.prototype as unknown as ProtoWithAdd;
      const addSpy = jest
        .spyOn(proto, "addTransferJob")
        .mockResolvedValue(fakeJob as unknown as Promise<unknown>);

      await svc.enqueueTransfer(payload);
      expect(IdempotencyRepository.findByKey).not.toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });
});
