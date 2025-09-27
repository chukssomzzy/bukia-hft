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
    duplicate: jest
      .fn()
      .mockImplementation(() => new (require("events").EventEmitter)()),
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

import type { TransferRequestType } from "../../schema/transfer.schema";
import type { CurrencyConversionService } from "../../services/currency-convertion.services";

import { IdempotencyRepository } from "../../repositories/idempotency.repository";
import { WalletRepository } from "../../repositories/wallet.repository";
import {
  OptimisticLockError,
  PermanentError,
  TransferServices,
} from "../../services/transfer.services";

interface ProtoWithAdd {
  addTransferJob(
    payload: TransferRequestType,
    options?: unknown,
  ): Promise<unknown>;
}

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

      // existing completed
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({
        status: "completed",
      });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Idempotency key already processed",
      );

      // processing
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({
        status: "processing",
      });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Transfer is already being processed",
      );

      // failed
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({
        status: "failed",
      });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow(
        "Previous transfer failed, cannot enqueue",
      );

      // none -> should create record and call addTransferJob
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

      const res = await svc.enqueueTransfer({ ...payloadBase });
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

      const res = await svc.enqueueTransfer(payload);
      expect(IdempotencyRepository.findByKey).not.toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });

  describe("process", () => {
    const fakeConv: CurrencyConversionService = {
      convert: async () => 1,
      getRate: async () => 1,
    } as unknown as CurrencyConversionService;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns result on success", async () => {
      const payload = {
        idempotencyKey: "k",
        userId: 1,
      } as unknown as TransferRequestType & { userId: number };
      class TestSvc extends (TransferServices as any) {
        constructor(conv: any) {
          super(conv);
        }
        public async executeTransaction(p: any) {
          return { transferId: 2 };
        }
        public async sendTransferStatusEmail() {
          return;
        }
      }
      const svc = new TestSvc(fakeConv);

      const res = await svc.process(payload);

      expect(res).toEqual({ transferId: 2 });
    });

    it("retries on OptimisticLockError and eventually succeeds", async () => {
      const payload = {
        idempotencyKey: "k",
        userId: 1,
      } as unknown as TransferRequestType & { userId: number };
      let calls = 0;
      class TestSvc extends (TransferServices as any) {
        constructor(conv: any) {
          super(conv);
        }
        public async executeTransaction(p: any) {
          if (++calls === 1)
            throw Object.assign(new Error("lock"), {
              __proto__: OptimisticLockError.prototype,
            });
          return { transferId: 3 };
        }
        public async sendTransferStatusEmail() {
          return;
        }
      }
      const svc = new TestSvc(fakeConv);
      (svc as any).backoff = jest.fn().mockResolvedValue(undefined);
      (IdempotencyRepository.markAsFailed as jest.Mock).mockResolvedValue(
        undefined,
      );

      const res = await svc.process(payload);

      expect(calls).toBe(2);
      expect(IdempotencyRepository.markAsFailed).toHaveBeenCalled();
      expect(res).toEqual({ transferId: 3 });
    });

    it("marks idempotency as failed and returns on PermanentError", async () => {
      const payload = {
        idempotencyKey: "k",
        userId: 1,
      } as unknown as TransferRequestType & { userId: number };
      class TestSvc extends (TransferServices as any) {
        constructor(conv: any) {
          super(conv);
        }
        public async executeTransaction() {
          throw new PermanentError("perm");
        }
        public async sendTransferStatusEmail() {
          return;
        }
      }
      const svc = new TestSvc(fakeConv);

      const res = await svc.process(payload);

      expect(IdempotencyRepository.markAsFailed).toHaveBeenCalledWith(
        payload.idempotencyKey,
        "perm",
      );
      expect(res).toBeUndefined();
    });

    it("reconciles on duplicate-key errors and returns reconciliation result", async () => {
      const payload = {
        idempotencyKey: "k",
        userId: 1,
      } as unknown as TransferRequestType & { userId: number };

      const dupErr = new Error("duplicate key value");
      (dupErr as any).code = "23505";
      class TestSvc extends (TransferServices as any) {
        constructor(conv: any) {
          super(conv);
        }
        public async executeTransaction() {
          throw dupErr;
        }
        public async reconcile(k: string) {
          return { transferId: 9 };
        }
        public async sendTransferStatusEmail() {
          return;
        }
      }
      const svc = new TestSvc(fakeConv);
      (IdempotencyRepository.markAsFailed as jest.Mock).mockResolvedValue(
        undefined,
      );

      const res = await svc.process(payload);

      expect(res).toEqual({ transferId: 9 });
    });
  });
});
