import { EntityManager } from "typeorm";

import { Unauthorized } from "../middleware";
import { User } from "../models";
import { UserProfileRepository } from "../repositories/user-profile.repository";
import { UserRepository } from "../repositories/user.repository";
import {
  JWTUserPayloadSchema,
  LoginUserRequestType,
  LoginUserResponseSchema,
  LoginUserResponseType,
  RegisterUserRequestType,
} from "../schema/auth.schema";
import { signAccessToken, signRefreshToken, verifyJWT } from "../utils/auth";
import { Transactional } from "../utils/db";

export class AuthServices {
  private static generateUserTokens(user: User): {
    accessToken: string;
    refreshToken: string;
  } {
    const jwtPayload = {
      email: user.email,
      id: user.id,
      jwtVersion: user.jwtVersion,
      role: user.type,
    };

    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

    return { accessToken, refreshToken };
  }

  public async loginUser(
    payload: LoginUserRequestType,
  ): Promise<LoginUserResponseType> {
    const user = await UserRepository.findWithProfile({
      where: { email: payload.email },
    });

    if (
      !user ||
      !(await user.validatePassword(payload.password)) ||
      !user.isverified
    ) {
      throw new Unauthorized("Invalid email or password");
    }

    const tokens = AuthServices.generateUserTokens(user);
    return LoginUserResponseSchema.parse({
      ...tokens,
      role: user.type,
    });
  }

  public async logout(userId: number): Promise<void> {
    const user = await UserRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Unauthorized("User not found");
    }
    user.jwtVersion += 1;
    await user.save();
  }

  public async refreshToken(
    refreshToken: string,
  ): Promise<LoginUserResponseType> {
    const payload = verifyJWT(refreshToken);

    if (
      !payload ||
      !JWTUserPayloadSchema.safeParse(payload).success ||
      payload.type !== "refresh"
    ) {
      throw new Unauthorized("Invalid or expired refresh token");
    }

    const user = await UserRepository.findOne({ where: { id: payload.id } });
    if (!user || user.jwtVersion !== payload.jwtVersion) {
      throw new Unauthorized("Token version mismatch or user not found");
    }

    const tokens = AuthServices.generateUserTokens(user);

    return LoginUserResponseSchema.parse({
      ...tokens,
      role: user.type,
    });
  }

  @Transactional()
  public async registerUser(
    payload: RegisterUserRequestType,
    transactionManager?: EntityManager,
  ): Promise<User> {
    const profile = await UserProfileRepository.create(
      {
        ...payload,
        dob: new Date(payload.dob),
      },
      transactionManager,
    );

    const user = await UserRepository.create(
      {
        ...payload,
        password: await User.prototype.hashPassword(payload.password),
        profile,
      },
      transactionManager,
    );

    await transactionManager.save(user);

    return user;
  }
}
