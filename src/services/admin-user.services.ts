import { EntityManager } from "typeorm";

import { Conflict, ResourceNotFound } from "../middleware";
import { User } from "../models/user";
import { LedgerRepository } from "../repositories";
import { UserRepository } from "../repositories/user.repository";
import { WalletRepository } from "../repositories/wallet.repository";
import {
  MeResponseSchema,
  MeResponseType,
  PaginationQueryType,
} from "../schema";
import {
  AdminLockOutUserRequestType,
  AdminResetPasswordBodyType,
  AdminResetPasswordResponseType,
  AdminUserEditBodyType,
  AdminUserListQueryType,
  AdminUserListResponseType,
} from "../schema/admin-user.schema";
import {
  AdminResetPasswordResponseSchema,
  AdminUserListResponseSchema,
} from "../schema/admin-user.schema";
import { PaginatedLedgerResponseSchema } from "../schema/ledger.schema";
import { WalletListResponseSchema } from "../schema/wallet.schema";
import { Transactional } from "../utils/db";
import { emailService } from "./email.services";
import { RedisService } from "./redis.services";

export class AdminUserServices {
  public async deactivateUser(userId: number): Promise<void> {
    const user = await UserRepository.findOne({ where: { id: userId } });

    if (!user) throw new ResourceNotFound("User not found");

    user.deletedAt = new Date();
    user.jwtVersion = (user.jwtVersion ?? 0) + 1;

    await UserRepository.save(user);

    await UserRepository.findWithProfileAndWallets(userId);
  }

  public async getUser(userId: number): Promise<MeResponseType> {
    const user = await UserRepository.findWithProfileAndWallets(userId);
    if (!user) throw new ResourceNotFound("User not found");

    return MeResponseSchema.parse(user);
  }

  public async getUserTransactions(userId: number, query: PaginationQueryType) {
    const result = await LedgerRepository.getEntriesForUser(
      userId,
      query.page,
      query.pageSize,
      query.sort,
    );
    return PaginatedLedgerResponseSchema.parse(result);
  }

  public async getUserWallets(userId: number) {
    const wallets = await WalletRepository.getWalletsForUser(userId);
    return WalletListResponseSchema.parse(wallets);
  }

  public async listUsers(
    query: AdminUserListQueryType,
  ): Promise<AdminUserListResponseType> {
    const data = await UserRepository.listUsers(query);
    return AdminUserListResponseSchema.parse(data);
  }

  public async lockUser(
    userId: number,
    body: AdminLockOutUserRequestType,
  ): Promise<MeResponseType> {
    const user = await UserRepository.findOne({ where: { id: userId } });

    if (!user) throw new ResourceNotFound("User not found");

    const lockKey = `lockout:lock:auth:loginUser:${user.email}`;

    await RedisService.getClient().set(
      lockKey,
      "1",
      "EX",
      String(body.numberOfMinsToLockUser * 60),
    );

    user.jwtVersion = (user.jwtVersion ?? 0) + 1;
    await UserRepository.save(user);

    const refreshed = await UserRepository.findWithProfileAndWallets(userId);

    return MeResponseSchema.parse(refreshed);
  }

  @Transactional()
  public async resetPassword(
    userId: number,
    body: AdminResetPasswordBodyType | null,
    manager?: EntityManager,
  ): Promise<AdminResetPasswordResponseType> {
    const temp = body?.newPassword ?? Math.random().toString(36).slice(-10);
    const hashed = await User.prototype.hashPassword(temp);
    const user = await UserRepository.setPasswordAndIncrementJwt(
      userId,
      hashed,
      manager,
    );
    if (!user) throw new ResourceNotFound("User not found");

    await emailService.send(
      user.email,
      "admin.password-reset.success",
      { firstName: user.profile?.firstName ?? "", tempPassword: temp },
      "Password reset by admin",
    );

    return AdminResetPasswordResponseSchema.parse({
      tempPassword: body?.newPassword,
    });
  }
  public async unlockUser(userId: number): Promise<MeResponseType> {
    const user = await UserRepository.findOne({ where: { id: userId } });
    if (!user) throw new ResourceNotFound("User not found");

    const lockKey = `lockout:lock:auth:loginUser:${user.email}`;

    await RedisService.getClient().del(lockKey);

    user.jwtVersion = (user.jwtVersion ?? 0) + 1;
    await UserRepository.save(user);

    const refreshed = await UserRepository.findWithProfileAndWallets(userId);
    return MeResponseSchema.parse(refreshed);
  }

  @Transactional()
  public async updateUser(
    userId: number,
    body: AdminUserEditBodyType,
    manager?: EntityManager,
  ): Promise<MeResponseType> {
    const repo = manager.getRepository(User);

    const user = await repo.findOne({
      relations: ["profile"],
      where: { id: userId },
    });

    if (!user) {
      throw new ResourceNotFound("User not found.");
    }

    if (body.email && body.email !== user.email) {
      const emailTaken = await repo.findOne({ where: { email: body.email } });
      if (emailTaken) {
        throw new Conflict("Email already belongs to another user.");
      }
      user.email = body.email;
    }

    if (body.profile && user.profile) {
      Object.assign(user.profile, body.profile);
      await manager
        .getRepository(user.profile.constructor.name)
        .save(user.profile);
    }

    await repo.save(user);

    const refreshed = await UserRepository.findWithProfileAndWallets(user.id);
    return MeResponseSchema.parse(refreshed);
  }
}

export const adminUserServices = new AdminUserServices();
