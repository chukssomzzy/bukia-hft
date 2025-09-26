import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { Idempotency } from "../models";

export const IdempotencyRepository = AppDataSource.getRepository(
  Idempotency,
).extend({
  async createRecord(key: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    await repo
      .createQueryBuilder()
      .insert()
      .values({ key })
      .orIgnore()
      .execute();
    return repo.findOne({ where: { key } });
  },

  async findByKey(key: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    return repo.findOne({ where: { key } });
  },

  async markAsFailed(key: string, reason: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    return repo
      .createQueryBuilder()
      .update()
      .set({
        processedAt: () => "now()",
        response: { reason },
        status: "failed",
      })
      .where("key = :key", { key })
      .execute();
  },

  async markAsPending(key: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    return repo
      .createQueryBuilder()
      .update()
      .set({ processedAt: null, response: null, status: "pending" })
      .where("key = :key", { key })
      .execute();
  },

  async markAsProcessing(key: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    return repo
      .createQueryBuilder()
      .update()
      .set({ processedAt: () => "now()", status: "processing" })
      .where("key = :key", { key })
      .execute();
  },

  async markCompleted(
    key: string,
    response: null | Record<string, unknown>,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    return repo
      .createQueryBuilder()
      .update()
      .set({ processedAt: () => "now()", response, status: "completed" })
      .where("key = :key", { key })
      .execute();
  },

  async markProcessingRecord(key: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Idempotency) : this;
    return repo
      .createQueryBuilder()
      .update()
      .set({ status: "processing" })
      .where("key = :key AND status = 'pending'", { key })
      .execute();
  },
});
