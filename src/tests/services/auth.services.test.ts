import { EntityManager } from "typeorm";

import { BadRequest, ResourceNotFound, Unauthorized } from "../../middleware";
import { User, UserProfile } from "../../models";
import { UserProfileRepository } from "../../repositories/user-profile.repository";
import { UserRepository } from "../../repositories/user.repository";
import {
  LoginUserRequestType,
  LoginUserResponseSchema,
  RegisterUserRequestType,
  ResetPasswordRequestType,
  ValidateOtpType,
} from "../../schema/auth.schema";
import { AuthServices } from "../../services/auth.services";
import { emailService } from "../../services/email.services";
import * as redisModule from "../../services/redis.services";
import { RateLimitOptions } from "../../utils";
import { signAccessToken, signRefreshToken, verifyJWT } from "../../utils/auth";
import * as authUtils from "../../utils/auth";

jest.mock("../../utils/auth");
jest.mock("../../services/redis.services", () => ({
  RedisService: {
    getClient: jest.fn().mockReturnValue({
      del: jest.fn(),
      eval: jest.fn(),
      evalsha: jest.fn(),
      get: jest.fn(),
      script: jest.fn(),
      set: jest.fn(),
      ttl: jest.fn(),
    }),
  },
}));

const ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const REFRESH_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
jest.mock("../../repositories/user-profile.repository", () => ({
  UserProfileRepository: {
    create: jest.fn(),
    save: jest.fn(),
  },
}));

jest.mock("../../repositories/user.repository", () => ({
  UserRepository: {
    create: jest.fn(),
    findOne: jest.fn(),
    findWithProfile: jest.fn(),
    save: jest.fn(),
  },
}));

// Make findWithProfile delegate to findOne by default to simplify tests that mock only findOne
const _mockedUserRepo = jest.requireMock(
  "../../repositories/user.repository",
).UserRepository;
(_mockedUserRepo.findWithProfile as jest.Mock) =
  _mockedUserRepo.findOne as jest.Mock;

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    // Add other methods as needed
  })),
}));

jest.mock("../../services/email.services");
jest.mock("../../utils", () => ({
  RateLimitByKey:
    <T extends (...args: ReadonlyArray<unknown>) => Promise<unknown>>(
      _options: RateLimitOptions<T>,
    ) =>
    (
      _target: object,
      _propertyKey: string | symbol,
      _descriptor: TypedPropertyDescriptor<T>,
    ): void => {
      return;
    },
}));

jest.mock("../../utils/db", () => ({
  Transactional:
    () =>
    <T extends (...args: unknown[]) => Promise<unknown>>(
      _target: object,
      _propertyKey: string,
      _descriptor: TypedPropertyDescriptor<T>,
    ): void => {
      return;
    },
}));

describe("AuthServices.loginUser", () => {
  const service = new AuthServices();
  const basePayload = {
    email: "test@example.com",
    password: "password123A!",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws Unauthorized for invalid login", async () => {
    (UserRepository.findOne as jest.Mock).mockResolvedValue(null);
    const payload: LoginUserRequestType = {
      email: basePayload.email,
      password: basePayload.password,
    };
    await expect(service.loginUser(payload)).rejects.toThrow(Unauthorized);
  });

  it("logs in user and returns tokens", async () => {
    const user = {
      ...basePayload,
      id: 1,
      isverified: true,
      jwtVersion: 0,
      type: "User",
      validatePassword: jest.fn().mockResolvedValue(true),
    };
    (UserRepository.findOne as jest.Mock).mockResolvedValue(user);
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(user);
    (signAccessToken as jest.Mock).mockReturnValue(ACCESS_TOKEN);
    (signRefreshToken as jest.Mock).mockReturnValue(REFRESH_TOKEN);
    // pushService removed
    (redisModule.RedisService.getClient as jest.Mock).mockReturnValue({
      del: jest.fn(),
      evalsha: jest.fn().mockResolvedValue([0, 0]),
      get: jest.fn().mockResolvedValue(null),
      script: jest.fn().mockResolvedValue("dummy"),
      set: jest.fn(),
      ttl: jest.fn().mockResolvedValue(0),
    });
    const payload: LoginUserRequestType = {
      email: basePayload.email,
      password: basePayload.password,
    };

    const response = await service.loginUser(payload);
    expect(LoginUserResponseSchema.safeParse(response).success).toBe(true);
    expect(user.validatePassword).toHaveBeenCalledWith(payload.password);
    expect(response.accessToken).toBe(ACCESS_TOKEN);
    expect(response.refreshToken).toBe(REFRESH_TOKEN);
  });

  it("should login verified user and return tokens", async () => {
    const user = {
      ...basePayload,
      id: 1,
      isverified: true,
      jwtVersion: 0,
      type: "User",
      validatePassword: jest.fn().mockResolvedValue(true),
    };
    (UserRepository.findOne as jest.Mock).mockResolvedValue(user);
    // pushService removed

    const response = await service.loginUser(basePayload);
    expect(response.accessToken).toBeDefined();
    expect(response.refreshToken).toBeDefined();
    expect(response.role.toLowerCase()).toBe("user");
    expect(user.validatePassword).toHaveBeenCalledWith(basePayload.password);
  });

  it("should throw Unauthorized if user is not verified", async () => {
    const user = {
      ...basePayload,
      id: 2,
      isverified: false,
      jwtVersion: 0,
      type: "User",
      validatePassword: jest.fn().mockResolvedValue(true),
    };
    (UserRepository.findOne as jest.Mock).mockResolvedValue(user);

    await expect(service.loginUser(basePayload)).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("should throw Unauthorized if password is invalid", async () => {
    const user = {
      ...basePayload,
      id: 3,
      isverified: true,
      jwtVersion: 0,
      type: "User",
      validatePassword: jest.fn().mockResolvedValue(false),
    };
    (UserRepository.findOne as jest.Mock).mockResolvedValue(user);

    await expect(service.loginUser(basePayload)).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("should throw Unauthorized if user does not exist", async () => {
    (UserRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.loginUser(basePayload)).rejects.toThrow(
      "Invalid email or password",
    );
  });
});

describe("AuthServices.refreshToken", () => {
  const service = new AuthServices();
  const basePayload: RegisterUserRequestType = {
    country: "NG",
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    password: "password123A!",
    type: "User",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refreshes token if valid", async () => {
    const user = {
      ...basePayload,
      id: 1,
      jwtVersion: 0,
      type: "User",
    };
    (verifyJWT as jest.Mock).mockReturnValue({
      email: basePayload.email,
      id: 1,
      jwtVersion: 0,
      role: "user",
      type: "refresh",
    });
    (UserRepository.findOne as jest.Mock).mockResolvedValue(user);
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(user);
    (signAccessToken as jest.Mock).mockReturnValue(ACCESS_TOKEN);
    (signRefreshToken as jest.Mock).mockReturnValue(REFRESH_TOKEN);
    const response = await service.refreshToken("validRefreshToken");
    expect(LoginUserResponseSchema.safeParse(response).success).toBe(true);
    expect(response.accessToken).toBe(ACCESS_TOKEN);
    expect(response.refreshToken).toBe(REFRESH_TOKEN);
  });

  it("throws Unauthorized for invalid refresh token", async () => {
    (verifyJWT as jest.Mock).mockReturnValue(null);
    await expect(service.refreshToken("invalidToken")).rejects.toThrow(
      Unauthorized,
    );
  });

  it("throws Unauthorized when user not found after valid payload", async () => {
    (verifyJWT as jest.Mock).mockReturnValue({
      email: basePayload.email,
      id: 999,
      jwtVersion: 0,
      role: "user",
      type: "refresh",
    });
    (UserRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(service.refreshToken("someToken")).rejects.toThrow(
      Unauthorized,
    );
  });

  it("throws Unauthorized when jwtVersion mismatches", async () => {
    (verifyJWT as jest.Mock).mockReturnValue({
      email: basePayload.email,
      id: 1,
      jwtVersion: 999,
      role: "user",
      type: "refresh",
    });
    (UserRepository.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      jwtVersion: 0,
    });

    await expect(service.refreshToken("someToken")).rejects.toThrow(
      Unauthorized,
    );
  });
});

describe("AuthServices.logout", () => {
  const service = new AuthServices();
  const basePayload: RegisterUserRequestType = {
    country: "NG",
    email: "test@example.com",
    firstName: "John",
    lastName: "Doe",
    password: "password123A!",
    type: "User",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs out user by incrementing jwtVersion", async () => {
    const user = {
      ...basePayload,
      id: 1,
      jwtVersion: 0,
      save: jest.fn().mockResolvedValue(true),
    };
    (UserRepository.findOne as jest.Mock).mockResolvedValue(user);

    await service.logout(1);
    expect(user.jwtVersion).toBe(1);
    expect(user.save).toHaveBeenCalled();
  });

  it("throws Unauthorized when user not found", async () => {
    (UserRepository.findOne as jest.Mock).mockResolvedValue(null);
    await expect(service.logout(999)).rejects.toThrow(Unauthorized);
  });
});

describe("AuthServices.getOtp", () => {
  const service = new AuthServices();
  const email = "test@example.com";
  const purpose = "verify";
  const user = { email, profile: { firstName: "John" } };
  const client = {
    del: jest.fn(),
    evalsha: jest.fn(),
    get: jest.fn(),
    script: jest.fn(),
    set: jest.fn(),
    ttl: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (redisModule.RedisService.getClient as jest.Mock).mockReturnValue(client);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("stores hashed otp in redis and sends email (success)", async () => {
    jest.spyOn(authUtils, "generateOtp").mockReturnValue("654321");
    jest
      .spyOn(authUtils, "hashOtp")
      .mockImplementation((otp: string) => `hashed-${otp}`);
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);
    (emailService.send as jest.Mock).mockImplementationOnce(
      async () => undefined,
    );

    await expect(service.getOtp(email, purpose)).resolves.toBeUndefined();

    expect(authUtils.generateOtp).toHaveBeenCalled();
    expect(authUtils.hashOtp).toHaveBeenCalledWith("654321");
    expect(redisModule.RedisService.getClient).toHaveBeenCalled();
    expect(client.set).toHaveBeenCalledWith(
      `otp:${email}:${purpose}`,
      "hashed-654321",
      "EX",
      expect.any(Number),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      email,
      "user.otp",
      { expiryMinutes: 10, firstName: "John", otp: "654321" },
      "Bukia Gold HFT OTP code (expires in 10 minutes)",
    );
  });

  it("throws ResourceNotFound if user not found and does not call other services", async () => {
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(null);
    const generateSpy = jest.spyOn(authUtils, "generateOtp");

    await expect(
      service.getOtp("notfound@example.com", purpose),
    ).rejects.toThrow(ResourceNotFound);

    expect(generateSpy).not.toHaveBeenCalled();
    expect(redisModule.RedisService.getClient).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("propagates emailService errors after redis set (introceptive)", async () => {
    jest.spyOn(authUtils, "generateOtp").mockReturnValue("654321");
    jest
      .spyOn(authUtils, "hashOtp")
      .mockImplementation((otp: string) => `hashed-${otp}`);
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);
    (emailService.send as jest.Mock).mockRejectedValueOnce(
      new Error("Email error"),
    );

    await expect(service.getOtp(email, purpose)).rejects.toThrow("Email error");

    expect(authUtils.generateOtp).toHaveBeenCalled();
    expect(client.set).toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalled();
  });

  it("propagates redis set errors and does not call emailService", async () => {
    jest.spyOn(authUtils, "generateOtp").mockReturnValue("654321");
    jest
      .spyOn(authUtils, "hashOtp")
      .mockImplementation((otp: string) => `hashed-${otp}`);
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);
    client.set.mockRejectedValueOnce(new Error("Redis set error"));

    await expect(service.getOtp(email, purpose)).rejects.toThrow(
      "Redis set error",
    );

    expect(authUtils.generateOtp).toHaveBeenCalled();
    expect(client.set).toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

describe("AuthServices.handleOtpType", () => {
  const email = "test@example.com";
  const typedHandleOtpType = (
    AuthServices as unknown as {
      handleOtpType: (email: string, purpose: string) => Promise<void>;
    }
  ).handleOtpType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("verifies unverified user, saves and sends welcome email (introceptive)", async () => {
    const user = {
      email,
      isverified: false,
      profile: { firstName: "John" },
      save: jest.fn().mockResolvedValue(undefined),
    };

    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);
    (emailService.send as jest.Mock).mockImplementationOnce(
      async () => undefined,
    );

    await expect(
      typedHandleOtpType(email, "emailVerification"),
    ).resolves.toBeUndefined();

    expect(user.isverified).toBe(true);
    expect(user.save).toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalledWith(email, "user.welcome", {
      firstName: "John",
    });

    const saveOrder = user.save.mock.invocationCallOrder[0];
    const emailOrder = (emailService.send as jest.Mock).mock
      .invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(emailOrder);
  });

  it("does nothing if user already verified", async () => {
    const user = {
      email,
      isverified: true,
      profile: { firstName: "John" },
      save: jest.fn().mockResolvedValue(undefined),
    };

    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);

    await expect(
      typedHandleOtpType(email, "emailVerification"),
    ).resolves.toBeUndefined();

    expect(user.save).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("throws BadRequest for unknown otp purpose and does not send email", async () => {
    const user = { email };
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);

    await expect(typedHandleOtpType(email, "unknownPurpose")).rejects.toThrow(
      BadRequest,
    );
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("handles passwordReset otp purpose (no-op)", async () => {
    const user = {
      email,
      isverified: false,
      profile: { firstName: "John" },
      save: jest.fn(),
    };
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValueOnce(user);

    await expect(
      typedHandleOtpType(email, "passwordReset"),
    ).resolves.toBeUndefined();
    expect(emailService.send).not.toHaveBeenCalled();
  });
});

describe("AuthServices.validateOtp", () => {
  const service = new AuthServices();
  const client = {
    del: jest.fn(),
    evalsha: jest.fn(),
    get: jest.fn(),
    script: jest.fn(),
    set: jest.fn(),
    ttl: jest.fn(),
  };
  const email = "test@example.com";

  beforeEach(() => {
    jest.clearAllMocks();
    (redisModule.RedisService.getClient as jest.Mock).mockReturnValue(client);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("validates OTP, sets verified flag, deletes otp and handles otp type (introceptive)", async () => {
    const payload: ValidateOtpType = {
      email,
      otp: "123456",
      purpose: "emailVerification",
    };

    jest
      .spyOn(authUtils, "hashOtp")
      .mockImplementation((otp: string) => `h-${otp}`);
    (client.get as jest.Mock).mockResolvedValueOnce("h-123456");
    (client.set as jest.Mock).mockImplementationOnce(async () => undefined);
    (client.del as jest.Mock).mockImplementationOnce(async () => undefined);

    const handleSpy = jest
      .spyOn(
        AuthServices as unknown as {
          handleOtpType: (email: string, purpose: string) => Promise<void>;
        },
        "handleOtpType",
      )
      .mockImplementation(async () => undefined) as jest.SpyInstance;

    await expect(service.validateOtp(payload)).resolves.toBeUndefined();

    expect(authUtils.hashOtp).toHaveBeenCalledWith("123456");
    expect(redisModule.RedisService.getClient).toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledWith(`otp:${email}:emailVerification`);
    expect(client.set).toHaveBeenCalledWith(
      `otp_verified:${email}:emailVerification`,
      "true",
      "EX",
      expect.any(Number),
    );
    expect(client.del).toHaveBeenCalledWith(`otp:${email}:emailVerification`);
    expect(handleSpy).toHaveBeenCalledWith(email, "emailVerification");

    const getOrder = (client.get as jest.Mock).mock.invocationCallOrder[0];
    const setOrder = (client.set as jest.Mock).mock.invocationCallOrder[0];
    const delOrder = (client.del as jest.Mock).mock.invocationCallOrder[0];
    const handleOrder = (handleSpy as jest.SpyInstance).mock
      .invocationCallOrder[0];

    expect(getOrder).toBeLessThan(setOrder);
    expect(setOrder).toBeLessThan(delOrder);
    expect(delOrder).toBeLessThan(handleOrder);
  });

  it("throws BadRequest when stored otp missing and does not call set/del/handle", async () => {
    const payload: ValidateOtpType = {
      email,
      otp: "123456",
      purpose: "emailVerification",
    };

    jest
      .spyOn(authUtils, "hashOtp")
      .mockImplementation((otp: string) => `h-${otp}`);
    (client.get as jest.Mock).mockResolvedValueOnce(null);

    const handleSpy = jest
      .spyOn(
        AuthServices as unknown as {
          handleOtpType: (email: string, purpose: string) => Promise<void>;
        },
        "handleOtpType",
      )
      .mockImplementation(async () => undefined) as jest.SpyInstance;

    await expect(service.validateOtp(payload)).rejects.toThrow(BadRequest);

    expect(client.get).toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it("throws BadRequest when otp hash mismatches and does not call set/del/handle", async () => {
    const payload: ValidateOtpType = {
      email,
      otp: "123456",
      purpose: "emailVerification",
    };

    jest
      .spyOn(authUtils, "hashOtp")
      .mockImplementation((otp: string) => `h-${otp}`);
    (client.get as jest.Mock).mockResolvedValueOnce("some-other-hash");

    const handleSpy = jest
      .spyOn(
        AuthServices as unknown as {
          handleOtpType: (email: string, purpose: string) => Promise<void>;
        },
        "handleOtpType",
      )
      .mockImplementation(async () => undefined) as jest.SpyInstance;

    await expect(service.validateOtp(payload)).rejects.toThrow(BadRequest);

    expect(client.get).toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it("propagates redis get errors and does not call handleOtpType", async () => {
    const payload: ValidateOtpType = {
      email,
      otp: "123456",
      purpose: "emailVerification",
    };

    (client.get as jest.Mock).mockRejectedValueOnce(
      new Error("Redis get error"),
    );

    const handleSpy = jest
      .spyOn(
        AuthServices as unknown as {
          handleOtpType: (email: string, purpose: string) => Promise<void>;
        },
        "handleOtpType",
      )
      .mockImplementation(async () => undefined) as jest.SpyInstance;

    await expect(service.validateOtp(payload)).rejects.toThrow(
      "Redis get error",
    );

    expect(client.get).toHaveBeenCalled();
    expect(handleSpy).not.toHaveBeenCalled();
  });
});

describe("AuthServices.resetPassword", () => {
  const service = new AuthServices();
  const client = {
    del: jest.fn(),
    evalsha: jest.fn(),
    get: jest.fn(),
    script: jest.fn(),
    set: jest.fn(),
    ttl: jest.fn(),
  };
  const email = "test@example.com";

  beforeEach(() => {
    jest.clearAllMocks();
    (redisModule.RedisService.getClient as jest.Mock).mockReturnValue(client);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resets password successfully and sends notification (introceptive)", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("true");

    const user = {
      email,
      hashPassword: jest.fn().mockResolvedValue("hashed-pass"),
      profile: { firstName: "John" },
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as User;

    (UserRepository.findOne as jest.Mock).mockResolvedValueOnce(user);
    (client.del as jest.Mock).mockImplementationOnce(async () => undefined);
    (emailService.send as jest.Mock).mockImplementationOnce(
      async () => undefined,
    );

    await expect(service.resetPassword(payload)).resolves.toBeUndefined();

    expect(user.hashPassword).toHaveBeenCalledWith(payload.newPassword);
    expect(user.save).toHaveBeenCalled();
    expect(client.del).toHaveBeenCalledWith(
      `otp_verified:${email}:passwordReset`,
    );
    expect(emailService.send).toHaveBeenCalledWith(
      user.email,
      "user.password-reset.success",
      { firstName: "John" },
      expect.any(String),
    );

    const saveOrder = (user.save as jest.Mock).mock.invocationCallOrder[0];
    const delOrder = (client.del as jest.Mock).mock.invocationCallOrder[0];
    const emailOrder = (emailService.send as jest.Mock).mock
      .invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(delOrder);
    expect(delOrder).toBeLessThan(emailOrder);
  });

  it("throws Unauthorized when reset not verified and does not call downstream services", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("false");

    await expect(service.resetPassword(payload)).rejects.toThrow(Unauthorized);

    expect(UserRepository.findOne).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("throws BadRequest when user not found and does not delete or send email", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("true");
    (UserRepository.findOne as jest.Mock).mockResolvedValueOnce(null);

    await expect(service.resetPassword(payload)).rejects.toThrow(BadRequest);

    expect(client.del).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("propagates hashPassword error and does not call save/del/email", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("true");

    const user = {
      email,
      hashPassword: jest.fn().mockRejectedValueOnce(new Error("Hash error")),
      profile: {},
      save: jest.fn(),
    } as unknown as User;

    (UserRepository.findOne as jest.Mock).mockResolvedValueOnce(user);

    await expect(service.resetPassword(payload)).rejects.toThrow("Hash error");

    expect(user.hashPassword).toHaveBeenCalledWith(payload.newPassword);
    expect(user.save).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("propagates user.save error and does not call del/email", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("true");

    const user = {
      email,
      hashPassword: jest.fn().mockResolvedValue("hashed-pass"),
      profile: {},
      save: jest.fn().mockRejectedValueOnce(new Error("Save error")),
    } as unknown as User;

    (UserRepository.findOne as jest.Mock).mockResolvedValueOnce(user);

    await expect(service.resetPassword(payload)).rejects.toThrow("Save error");

    expect(user.hashPassword).toHaveBeenCalledWith(payload.newPassword);
    expect(user.save).toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("propagates redis del error and does not call emailService", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("true");

    const user = {
      email,
      hashPassword: jest.fn().mockResolvedValue("hashed-pass"),
      profile: { firstName: "John" },
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as User;

    (UserRepository.findOne as jest.Mock).mockResolvedValueOnce(user);
    (client.del as jest.Mock).mockRejectedValueOnce(
      new Error("Redis del error"),
    );

    await expect(service.resetPassword(payload)).rejects.toThrow(
      "Redis del error",
    );

    expect(user.save).toHaveBeenCalled();
    expect(client.del).toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("propagates emailService errors after del", async () => {
    const payload: ResetPasswordRequestType = {
      email,
      newPassword: "NewP@ssw0rd1",
    };
    (client.get as jest.Mock).mockResolvedValueOnce("true");

    const user = {
      email,
      hashPassword: jest.fn().mockResolvedValue("hashed-pass"),
      profile: { firstName: "John" },
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as User;

    (UserRepository.findOne as jest.Mock).mockResolvedValueOnce(user);
    (client.del as jest.Mock).mockImplementationOnce(async () => undefined);
    (emailService.send as jest.Mock).mockRejectedValueOnce(
      new Error("Email error"),
    );

    await expect(service.resetPassword(payload)).rejects.toThrow("Email error");

    expect(user.save).toHaveBeenCalled();
    expect(client.del).toHaveBeenCalled();
    expect(emailService.send).toHaveBeenCalled();
  });
});

describe("AuthServices.registerUser", () => {
  let service: AuthServices;
  let mockManager: { getRepository: jest.Mock; save: jest.Mock };
  let basePayload: RegisterUserRequestType;
  let mockProfile: UserProfile;
  let mockUser: User;

  beforeEach(() => {
    service = new AuthServices();
    mockManager = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn().mockImplementation((obj) => obj),
        save: jest.fn().mockResolvedValue(undefined),
      }),
      save: jest.fn(),
    };
    basePayload = {
      email: "superadmin@example.com",
      firstName: "Super",
      lastName: "Admin",
      password: "password123A!",
      type: "Superadmin",
    };
    mockProfile = { ...basePayload } as UserProfile;
    mockUser = { ...basePayload, id: 1, profile: mockProfile } as User;

    jest.clearAllMocks();
    (User.prototype.hashPassword as jest.Mock) = jest.fn();
  });

  it("creates and saves profile and user, hashes password", async () => {
    (UserProfileRepository.create as jest.Mock).mockReturnValue(mockProfile);
    (UserRepository.create as jest.Mock).mockReturnValue(mockUser);
    (mockManager.save as jest.Mock).mockResolvedValue(mockUser);
    (User.prototype.hashPassword as jest.Mock).mockResolvedValue(
      "hashedPassword",
    );

    const result: User = await service.registerUser(
      basePayload,
      mockManager as unknown as EntityManager,
    );

    expect(UserProfileRepository.create).toHaveBeenCalledWith(
      { ...basePayload },
      mockManager as unknown as EntityManager,
    );

    expect(UserProfileRepository.save).not.toHaveBeenCalledWith(
      mockProfile,
      mockManager as unknown as EntityManager,
    );

    expect(User.prototype.hashPassword).toHaveBeenCalledWith(
      basePayload.password,
    );

    expect(UserRepository.create).toHaveBeenCalledWith(
      {
        ...basePayload,
        password: "hashedPassword",
        profile: mockProfile,
      },
      mockManager as unknown as EntityManager,
    );

    expect(UserRepository.save).not.toHaveBeenCalledWith(
      mockUser,
      mockManager as unknown as EntityManager,
    );
    expect(mockManager.save).toHaveBeenCalledWith(mockUser);
    expect(result).toBe(mockUser);
  });

  it("throws error if super admin already exists", async () => {
    (UserProfileRepository.create as jest.Mock).mockReturnValue(mockProfile);
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(mockProfile);
    (UserRepository.create as jest.Mock).mockImplementation(() => {
      throw new BadRequest("A super admin already exists.");
    });

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("A super admin already exists.");
    expect(UserRepository.create).toHaveBeenCalled();
    expect(UserRepository.save).not.toHaveBeenCalled();
  });

  it("propagates errors from profile creation", async () => {
    (UserProfileRepository.create as jest.Mock).mockImplementation(() => {
      throw new Error("Profile create error");
    });

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("Profile create error");
    expect(UserProfileRepository.create).toHaveBeenCalled();
    expect(UserProfileRepository.save).not.toHaveBeenCalled();
    expect(UserRepository.create).not.toHaveBeenCalled();
    expect(UserRepository.save).not.toHaveBeenCalled();
  });

  it("propagates errors from create error", async () => {
    (UserProfileRepository.create as jest.Mock).mockRejectedValue(
      new Error("Profile create error"),
    );

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("Profile create error");

    expect(UserProfileRepository.save).not.toHaveBeenCalledWith(
      mockProfile,
      mockManager as unknown as EntityManager,
    );
    expect(UserRepository.create).not.toHaveBeenCalled();
    expect(UserRepository.save).not.toHaveBeenCalled();
  });

  it("propagates errors from user saving", async () => {
    (UserProfileRepository.create as jest.Mock).mockReturnValue(mockProfile);
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(mockProfile);
    (User.prototype.hashPassword as jest.Mock).mockResolvedValue(
      "hashedPassword",
    );
    (UserRepository.create as jest.Mock).mockReturnValue(mockUser);
    (mockManager.save as jest.Mock).mockRejectedValue(
      new Error("User save error"),
    );

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("User save error");
    expect(mockManager.save).toHaveBeenCalledWith(mockUser);
  });

  it("propagates errors from password hashing", async () => {
    (UserProfileRepository.create as jest.Mock).mockReturnValue(mockProfile);
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(mockProfile);
    (User.prototype.hashPassword as jest.Mock).mockRejectedValue(
      new Error("Hash error"),
    );

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("Hash error");
    expect(User.prototype.hashPassword).toHaveBeenCalledWith(
      basePayload.password,
    );
    expect(UserRepository.create).not.toHaveBeenCalled();
    expect(UserRepository.save).not.toHaveBeenCalled();
  });

  it("creates user with regular type successfully", async () => {
    const regularPayload: RegisterUserRequestType = {
      ...basePayload,
      type: "User",
    };
    const regularProfile: UserProfile = {
      ...regularPayload,
    } as UserProfile;
    const regularUser: User = {
      ...regularPayload,
      id: 2,
      profile: regularProfile,
    } as User;

    (UserProfileRepository.create as jest.Mock).mockReturnValue(regularProfile);
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(regularProfile);
    (UserRepository.create as jest.Mock).mockReturnValue(regularUser);
    (UserRepository.save as jest.Mock).mockResolvedValue(regularUser);
    (User.prototype.hashPassword as jest.Mock).mockResolvedValue(
      "hashedPassword",
    );

    const result: User = await service.registerUser(
      regularPayload,
      mockManager as unknown as EntityManager,
    );

    expect(UserRepository.create).toHaveBeenCalledWith(
      {
        ...regularPayload,
        password: "hashedPassword",
        profile: regularProfile,
      },
      mockManager as unknown as EntityManager,
    );
    expect(result).toBe(regularUser);
  });
});

// Additional tests to exercise the real RateLimitByKey decorator paths
describe("AuthServices RateLimit decorator (real) flows", () => {
  const client = { eval: jest.fn(), set: jest.fn(), ttl: jest.fn() };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("allows getOtp when redis count <= max", async () => {
    client.eval.mockResolvedValueOnce(1);
    client.set.mockResolvedValueOnce(undefined);

    jest.doMock("../../services/redis.services", () => ({
      RedisService: { getClient: () => client },
    }));
    jest.doMock("../../repositories/user.repository", () => ({
      UserRepository: {
        findWithProfile: jest.fn().mockResolvedValue({
          email: "r@example.com",
          profile: { firstName: "R" },
        }),
      },
    }));
    jest.doMock("../../services/email.services", () => ({
      emailService: { send: jest.fn().mockResolvedValue(undefined) },
    }));
    jest.unmock("../../utils");

    const { AuthServices } = await import("../../services/auth.services");
    const svc = new AuthServices();

    await expect(
      svc.getOtp("r@example.com", "emailVerification"),
    ).resolves.toBeUndefined();

    expect(client.eval).toHaveBeenCalled();
    const { emailService: es } = await import("../../services/email.services");
    expect(es.send).toHaveBeenCalled();
  });

  it("throws when redis count exceeds max", async () => {
    client.eval.mockResolvedValueOnce(2);
    client.ttl.mockResolvedValueOnce(30);

    jest.doMock("../../services/redis.services", () => ({
      RedisService: { getClient: () => client },
    }));
    jest.doMock("../../repositories/user.repository", () => ({
      UserRepository: {
        findWithProfile: jest.fn().mockResolvedValue({
          email: "r@example.com",
          profile: { firstName: "R" },
        }),
      },
    }));
    jest.unmock("../../utils");

    const { AuthServices } = await import("../../services/auth.services");
    const svc = new AuthServices();

    await expect(
      svc.getOtp("r@example.com", "emailVerification"),
    ).rejects.toBeDefined();

    expect(client.eval).toHaveBeenCalled();
    expect(client.ttl).toHaveBeenCalled();
  });
});
