import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { Transfer } from "../models";

export const TransferRepository = AppDataSource.getRepository(Transfer).extend({
  async createTransfer(entity: Partial<Transfer>, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Transfer) : this;
    return repo.save(repo.create(entity));
  },

  async findByIdempotencyKey(key: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(Transfer) : this;
    return repo.findOne({ where: { idempotencyKey: key } });
  },
});
