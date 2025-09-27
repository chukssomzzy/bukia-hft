import { EntityManager } from "typeorm";

import AppDataSource from "../data-source";
import { UserRole } from "../enums/user-roles";
import { BadRequest } from "../middleware";
import { User } from "../models";
import { AdminUserListQueryType } from "../schema/admin-user.schema";

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

  async findWithProfileAndWallets(id: number) {
    return this.findOne({ relations: ["profile", "wallets"], where: { id } });
  },

  async listUsers(params: AdminUserListQueryType) {
    const { page, pageSize, role, search } = params;
    const qb = this.createQueryBuilder("user").leftJoinAndSelect(
      "user.profile",
      "profile",
    );
    if (search && search.trim()) {
      qb.where(
        "user.email ILIKE :q OR profile.firstName ILIKE :q OR profile.lastName ILIKE :q",
        { q: `%${search}%` },
      );
    }
    if (role && role.trim()) {
      qb.andWhere("user.type = :role", { role });
    }
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, page, pageSize, total };
  },

  async setPasswordAndIncrementJwt(
    id: number,
    hashedPassword: string,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(User) : this;
    const user = await repo.findOne({ relations: ["profile"], where: { id } });
    if (!user) return null;
    user.password = hashedPassword;
    user.jwtVersion = (user.jwtVersion ?? 0) + 1;
    await repo.save(user);
    return user;
  },

  async updatePartial(
    id: number,
    patch: Partial<User>,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(User) : this;
    await repo.update({ id }, patch);
    return repo.findOne({ relations: ["profile"], where: { id } });
  },
});
