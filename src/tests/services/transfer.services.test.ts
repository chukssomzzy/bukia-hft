jest.mock('../../repositories/wallet.repository', () => ({
  WalletRepository: {
    findById: jest.fn(),
    getBalance: jest.fn(),
  },
}));

jest.mock('../../repositories/idempotency.repository', () => ({
  IdempotencyRepository: {
    findByKey: jest.fn(),
    createRecord: jest.fn(),
    markAsFailed: jest.fn(),
    markProcessingRecord: jest.fn().mockResolvedValue({ affected: 1 }),
    markCompleted: jest.fn(),
  },
}));

jest.mock('bullmq', () => {
  class FakeQueue {
    add(_name: string, _payload: unknown, _opts?: unknown) {
      return Promise.resolve({ id: 'job' });
    }
  }
  return { Queue: FakeQueue };
});

jest.mock('../../services/email.services', () => ({
  emailService: { send: jest.fn() },
}));

jest.mock('../../config', () => ({ default: { TRANSFER_OPTIMISTIC_RETRIES: 1, TRANSFER_BACKOFF_MS: 1, TRANSFER_RETRY_LIMIT: 1 } }));

jest.mock('../../services/redis.services', () => ({
  RedisService: { duplicate: jest.fn().mockImplementation(() => new (require('events').EventEmitter)()) },
}));

jest.mock('../../utils/db', () => ({
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

import { TransferServices, OptimisticLockError, PermanentError } from '../../services/transfer.services';
import { WalletRepository } from '../../repositories/wallet.repository';
import { IdempotencyRepository } from '../../repositories/idempotency.repository';
import type { TransferRequestType } from '../../schema/transfer.schema';
import type { CurrencyConversionService } from '../../services/currency-convertion.services';

type ProtoWithAdd = { addTransferJob(payload: TransferRequestType, options?: unknown): Promise<unknown> };

describe('TransferServices', () => {
  describe('enqueueTransfer', () => {
    let svc: TransferServices;
    const payloadBase = {
      amount: '100',
      fromWalletId: 1,
      toWalletId: 2,
      idempotencyKey: 'idem-key',
      txId: 'tx-1',
      currency: 'USD',
      metadata: {},
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

    it('throws when user does not own wallet and calls WalletRepository.findById with fromWalletId', async () => {
      (WalletRepository.findById as jest.Mock).mockResolvedValue({ userId: 2 });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow('User is not the owner of wallet');
      expect(WalletRepository.findById).toHaveBeenCalledWith(payloadBase.fromWalletId);
    });

    it('throws when insufficient funds and calls WalletRepository.getBalance with fromWalletId', async () => {
      (WalletRepository.findById as jest.Mock).mockResolvedValue({ userId: payloadBase.userId });
      (WalletRepository.getBalance as jest.Mock).mockResolvedValue(50);
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow('Insufficient funds');
      expect(WalletRepository.getBalance).toHaveBeenCalledWith(payloadBase.fromWalletId);
    });

    it('handles idempotency states and creates record when none exists then enqueues', async () => {
      (WalletRepository.findById as jest.Mock).mockResolvedValue({ userId: payloadBase.userId });
      (WalletRepository.getBalance as jest.Mock).mockResolvedValue('200');

      // existing completed
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({ status: 'completed' });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow('Idempotency key already processed');

      // processing
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({ status: 'processing' });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow('Transfer is already being processed');

      // failed
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce({ status: 'failed' });
      await expect(svc.enqueueTransfer({ ...payloadBase })).rejects.toThrow('Previous transfer failed, cannot enqueue');

      // none -> should create record and call addTransferJob
      (IdempotencyRepository.findByKey as jest.Mock).mockResolvedValueOnce(null);
      (IdempotencyRepository.createRecord as jest.Mock).mockResolvedValue(undefined);

      const fakeJob = { id: 'job-1' };
      const proto = TransferServices.prototype as unknown as Record<string, unknown>;
      const originalAdd = proto.addTransferJob;
      const addSpy = jest.fn().mockResolvedValue(fakeJob);
      proto.addTransferJob = addSpy;

      const res = await svc.enqueueTransfer({ ...payloadBase });
      expect(IdempotencyRepository.createRecord).toHaveBeenCalledWith(payloadBase.idempotencyKey);
      expect(addSpy).toHaveBeenCalledWith(expect.objectContaining({ fromWalletId: payloadBase.fromWalletId, toWalletId: payloadBase.toWalletId, amount: payloadBase.amount }), undefined);
      proto.addTransferJob = originalAdd;
    });

    it('does not touch idempotency when no idempotencyKey provided and enqueues', async () => {
      const payload = { ...payloadBase, idempotencyKey: undefined } as TransferRequestType & { userId: number };
      (WalletRepository.findById as jest.Mock).mockResolvedValue({ userId: payload.userId });
      (WalletRepository.getBalance as jest.Mock).mockResolvedValue('200');
      const fakeJob = { id: 'job-2' };

      const proto = TransferServices.prototype as unknown as ProtoWithAdd;
      const addSpy = jest.spyOn(proto, 'addTransferJob').mockResolvedValue(fakeJob as unknown as Promise<unknown>);

      const res = await svc.enqueueTransfer(payload);
      expect(IdempotencyRepository.findByKey).not.toHaveBeenCalled();
      expect(addSpy).toHaveBeenCalled();
      addSpy.mockRestore();
    });
  });

  describe('process', () => {
    const fakeConv: CurrencyConversionService = {
      convert: async () => 1,
      getRate: async () => 1,
    } as unknown as CurrencyConversionService;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns result on success', async () => {
      const payload = { idempotencyKey: 'k', userId: 1 } as unknown as TransferRequestType & { userId: number };
      const execSpy = jest.spyOn(TransferServices.prototype as any, 'executeTransaction').mockResolvedValue({ transferId: 2 });
      const svc = new TransferServices(fakeConv);

      const res = await svc.process(payload);

      expect(execSpy).toHaveBeenCalledWith(payload);
      expect(res).toEqual({ transferId: 2 });

      execSpy.mockRestore();
    });

    it('retries on OptimisticLockError and eventually succeeds', async () => {
      const payload = { idempotencyKey: 'k', userId: 1 } as unknown as TransferRequestType & { userId: number };

      const execSpy = jest.spyOn(TransferServices.prototype as any, 'executeTransaction')
        .mockRejectedValueOnce(Object.assign(new Error('lock'), { __proto__: OptimisticLockError.prototype }))
        .mockResolvedValueOnce({ transferId: 3 });

      const backoffSpy = jest.spyOn(TransferServices.prototype as any, 'backoff').mockResolvedValue(undefined);
      (IdempotencyRepository.markAsFailed as jest.Mock).mockResolvedValue(undefined);

      const svc = new TransferServices(fakeConv);
      const res = await svc.process(payload);

      expect(execSpy).toHaveBeenCalledTimes(2);
      expect(IdempotencyRepository.markAsFailed).toHaveBeenCalled();
      expect(res).toEqual({ transferId: 3 });

      execSpy.mockRestore();
      backoffSpy.mockRestore();
    });

    it('marks idempotency as failed and returns on PermanentError', async () => {
      const payload = { idempotencyKey: 'k', userId: 1 } as unknown as TransferRequestType & { userId: number };
      const perm = new PermanentError('perm');
      const execSpy = jest.spyOn(TransferServices.prototype as any, 'executeTransaction').mockRejectedValue(perm);

      const svc = new TransferServices(fakeConv);
      const res = await svc.process(payload);

      expect(IdempotencyRepository.markAsFailed).toHaveBeenCalledWith(payload.idempotencyKey, perm.message);
      expect(res).toBeUndefined();

      execSpy.mockRestore();
    });

    it('reconciles on duplicate-key errors and returns reconciliation result', async () => {
      const payload = { idempotencyKey: 'k', userId: 1 } as unknown as TransferRequestType & { userId: number };

      const dupErr = new Error('duplicate key value');
      (dupErr as any).code = '23505';
      const svc = new TransferServices(fakeConv);
      const execSpy = jest.fn().mockRejectedValue(dupErr);
      (svc as any).executeTransaction = execSpy;
      const reconcileSpy = jest.fn().mockResolvedValue({ transferId: 9 });
      (svc as any).reconcile = reconcileSpy;
      (IdempotencyRepository.markAsFailed as jest.Mock).mockResolvedValue(undefined);

      const res = await svc.process(payload);

      expect(reconcileSpy).toHaveBeenCalledWith(payload.idempotencyKey);
      expect(res).toEqual({ transferId: 9 });

      execSpy.mockRestore?.();
      reconcileSpy.mockRestore?.();
    });
  });
});
