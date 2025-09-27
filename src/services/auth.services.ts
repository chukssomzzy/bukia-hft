import { EntityManager } from "typeorm";

import config from "../config";
import { UserRole } from "../enums/user-roles";
import {
  BadRequest,
  Conflict,
  ResourceNotFound,
  Unauthorized,
} from "../middleware";
import { User } from "../models";
import { UserProfileRepository } from "../repositories/user-profile.repository";
import { UserRepository } from "../repositories/user.repository";
import {
  JWTUserPayloadSchema,
  LoginUserRequestType,
  LoginUserResponseSchema,
  LoginUserResponseType,
  OTP_PURPOSE,
  RegisterUserRequestType,
  ResetPasswordRequestType,
  ValidateOtpType,
} from "../schema/auth.schema";
import { RateLimitByKey } from "../utils";
import {
  generateOtp,
  hashOtp,
  signAccessToken,
  signRefreshToken,
  verifyJWT,
} from "../utils/auth";
import { isAuthorized } from "../utils/authorization";
import { Transactional } from "../utils/db";
import lockout from "../utils/lockout";
import { emailService } from "./email.services";
import { RedisService } from "./redis.services";
import { walletService } from "./wallet.services";

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

  private static async handleOtpType(
    email: string,
    purpose: (typeof OTP_PURPOSE)[number],
  ): Promise<void> {
    const user = await UserRepository.findWithProfile({ where: { email } });
    switch (purpose) {
      case OTP_PURPOSE[0]:
        if (user && !user.isverified) {
          user.isverified = true;
          await user.save();
          await emailService.send(user.email, "user.welcome", {
            firstName: user.profile.firstName ?? "",
          });
        }
        break;
      case OTP_PURPOSE[1]:
        break;
      case OTP_PURPOSE[2]:
        break;
      default:
        throw new BadRequest("Unknown OTP type.");
    }
  }

  @RateLimitByKey<(email: string, _) => Promise<void>>({
    keySelector: (email: string) => email,
    max: 1,
    message: "Too many OTP requests for this email. Try again later.",
    windowSec: 60,
  })
  public async getOtp(email: string, purpose: string): Promise<void> {
    // TODO: use userId for redis key to make it more generalized for endpoint that may not have email passed in payload
    const user = await UserRepository.findWithProfile({
      where: { email },
    });
    if (!user) {
      throw new ResourceNotFound("No user found with the provided email.");
    }

    const otp = generateOtp();
    const redisKey = `otp:${email}:${purpose}`;
    await RedisService.getClient().set(
      redisKey,
      hashOtp(otp),
      "EX",
      config.OTP_TTL_SEC,
    );

    await emailService.send(
      user.email,
      "user.otp",
      {
        expiryMinutes: 10,
        firstName: user.profile.firstName,
        otp,
      },
      "Bukia Gold HFT OTP code (expires in 10 minutes)",
    );
  }

  @isAuthorized(RedisService.getClient())
  @lockout(RedisService.getClient(), {
    failurePredicate: (err) => err instanceof Unauthorized,
    getIdFromArgs: (payload: LoginUserRequestType) => payload.email,
    lockSeconds: 900,
    serviceName: "auth",
    threshold: 5,
    windowSeconds: 60,
  })
  public async loginUser(
    payload: LoginUserRequestType,
    authorized?: boolean,
  ): Promise<LoginUserResponseType> {
    const user = await UserRepository.findWithProfile({
      where: { email: payload.email },
    });

    if (
      !user ||
      !(await user.validatePassword(payload.password)) ||
      !user.isverified
    )
      throw new Unauthorized("Invalid email or password");

    if (
      [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.type) &&
      !authorized
    )
      throw new Unauthorized("Not authorized");

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
    if (
      await UserRepository.findOne({
        where: { email: payload.email },
      })
    )
      throw new Conflict("Something went wrong");

    const profile = await UserProfileRepository.create(
      {
        ...payload,
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
    await walletService.createAndSaveDefaultWalletsForUser(
      user,
      transactionManager,
    );
    return user;
  }

  public async resetPassword({
    email,
    newPassword,
  }: ResetPasswordRequestType): Promise<void> {
    const verifiedKey = `otp_verified:${email}:${OTP_PURPOSE[1]}`;
    const isVerified = await RedisService.getClient().get(verifiedKey);

    if (isVerified !== "true") {
      throw new Unauthorized("Password reset not verified.");
    }

    const user = await UserRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequest("No user found with the provided email.");
    }

    user.password = await user.hashPassword(newPassword);
    await user.save();

    await RedisService.getClient().del(verifiedKey);

    await emailService.send(
      user.email,
      "user.password-reset.success",
      { firstName: user.profile?.firstName ?? "" },
      "Your password has been reset successfully",
    );
  }

  public async validateOtp({
    email,
    otp,
    purpose,
  }: ValidateOtpType): Promise<void> {
    const redisKey = `otp:${email}:${purpose}`;
    const storeOtpHash = await RedisService.getClient().get(redisKey);

    if (!storeOtpHash || storeOtpHash !== hashOtp(otp)) {
      throw new BadRequest("Invalid or expired OTP.");
    }

    await RedisService.getClient().set(
      `otp_verified:${email}:${purpose}`,
      "true",
      "EX",
      config.OTP_TTL_SEC,
    );

    await RedisService.getClient().del(redisKey);
    await AuthServices.handleOtpType(email, purpose);
  }
}
