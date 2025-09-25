import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { UserRole } from "../enums/user-roles";
import { BadRequest } from "../middleware";
import { User } from "../models";

export const UserRepository = AppDataSource.getRepository(User).extend({
  async create(
    entityLike: Partial<User>,
    manager?: EntityManager,
  ): Promise<User> {
    const repo = manager ? manager.getRepository(User) : this;
    if (entityLike.type === UserRole.SUPER_ADMIN) {
      const existing = await repo.findOne({
        where: { type: UserRole.SUPER_ADMIN },
      });
      if (existing) {
        throw new BadRequest("A super admin already exists.");
      }
    }
    return repo.create(entityLike);
  },

  async findByTypes(types: UserRole[] = []) {
    if (!types || types.length === 0) return [];
    return this.createQueryBuilder("user")
      .where("user.type IN (:...types)", { types })
      .getMany();
  },

  async findWithProfile(options: { where: object }) {
    return await this.findOne({
      ...options,
      relations: ["profile"],
    });
  },
});
