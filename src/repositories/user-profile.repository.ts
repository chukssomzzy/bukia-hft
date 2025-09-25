import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { UserProfile } from "../models";

export const UserProfileRepository = AppDataSource.getRepository(
  UserProfile,
).extend({
  async create(
    entityLike: Partial<UserProfile>,
    manager?: EntityManager,
  ): Promise<UserProfile> {
    const repo = manager ? manager.getRepository(UserProfile) : this;

    return repo.create(entityLike);
  },
});
