import { EntityManager } from "typeorm";

import { BadRequest, Unauthorized } from "../../middleware";
import { User, UserProfile } from "../../models";
import { UserProfileRepository } from "../../repositories/user-profile.repository";
import { UserRepository } from "../../repositories/user.repository";
import {
  LoginUserRequestType,
  LoginUserResponseSchema,
  RegisterUserRequestType,
} from "../../schema/auth.schema";
import type { AuthServices as AuthServicesClass } from "../../services/auth.services";
let AuthServices: new (...args: unknown[]) => AuthServicesClass;
import { RateLimitOptions } from "../../utils";
import { signAccessToken, signRefreshToken, verifyJWT } from "../../utils/auth";

jest.mock("../../repositories/user.repository", () => ({
  UserRepository: {
    findOne: jest.fn(),
    findWithProfile: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  },
}));
jest.mock("../../models/user");
jest.mock("../../utils/auth");
jest.mock("../../services/redis.services", () => ({
  RedisService: {
    getClient: jest.fn().mockReturnValue({
      del: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      ttl: jest.fn().mockResolvedValue(0),
      eval: jest.fn().mockResolvedValue(0),
      evalsha: jest.fn().mockResolvedValue([0, 0]),
      script: jest.fn().mockResolvedValue("sha"),
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

jest.mock("../../utils/lockout", () => ({
  __esModule: true,
  default: (_redis: unknown, _opts: unknown) => (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => descriptor,
}));

// Import the module after mocks to ensure decorators use mocked redis
const authMod = require("../../services/auth.services") as { AuthServices: typeof AuthServicesClass };
AuthServices = authMod.AuthServices;

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
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(null);
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
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(user);
    (signAccessToken as jest.Mock).mockReturnValue(ACCESS_TOKEN);
    (signRefreshToken as jest.Mock).mockReturnValue(REFRESH_TOKEN);
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
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(user);

    const response = await service.loginUser(basePayload);
    expect(response.accessToken).toBeDefined();
    expect(response.refreshToken).toBeDefined();
    expect(response.role).toBe("User");
    expect(user.validatePassword).toHaveBeenCalledWith(basePayload.password);
  });

  it("should allow login even if user is not verified", async () => {
    const user = {
      ...basePayload,
      id: 2,
      isverified: false,
      jwtVersion: 0,
      type: "User",
      validatePassword: jest.fn().mockResolvedValue(true),
    };
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(user);

    const response = await service.loginUser(basePayload);
    expect(response.accessToken).toBeDefined();
    expect(response.refreshToken).toBeDefined();
    expect(response.role).toBe("User");
    expect(user.validatePassword).toHaveBeenCalledWith(basePayload.password);
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
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(user);

    await expect(service.loginUser(basePayload)).rejects.toThrow(
      "Invalid email or password",
    );
  });

  it("should throw Unauthorized if user does not exist", async () => {
    (UserRepository.findWithProfile as jest.Mock).mockResolvedValue(null);

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

describe("AuthServices.registerUser", () => {
  let service: AuthServicesClass;
  let mockManager: { getRepository: jest.Mock; save: jest.Mock };
  let basePayload: RegisterUserRequestType;
  let mockUserProfile: UserProfile;
  let mockUser: User;

  beforeEach(() => {
    service = new AuthServices();
    mockManager = {
      getRepository: jest.fn(),
      save: jest.fn(),
    };
    mockManager.getRepository.mockReturnValue({
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    });
    basePayload = {
      country: "NG",
      email: "superadmin@example.com",
      firstName: "Super",
      lastName: "Admin",
      password: "password123A!",
      type: "Superadmin",
    };
    mockUserProfile = {
      ...basePayload,
    } as UserProfile;
    mockUser = { ...basePayload, id: 1, profile: mockUserProfile } as User;

    jest.clearAllMocks();
    (User.prototype.hashPassword as jest.Mock) = jest.fn();
  });

  it("creates and saves profile and user, hashes password", async () => {
    (UserProfileRepository.create as jest.Mock).mockReturnValue(
      mockUserProfile,
    );
    (UserRepository.create as jest.Mock).mockReturnValue(mockUser);
    (mockManager.save as jest.Mock).mockResolvedValue(mockUser);
    mockManager.getRepository.mockReturnValue({
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    });
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
      mockUserProfile,
      mockManager as unknown as EntityManager,
    );

    expect(User.prototype.hashPassword).toHaveBeenCalledWith(
      basePayload.password,
    );

    expect(UserRepository.create).toHaveBeenCalledWith(
      {
        ...basePayload,
        password: "hashedPassword",
        profile: mockUserProfile,
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
    (UserProfileRepository.create as jest.Mock).mockReturnValue(
      mockUserProfile,
    );
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(
      mockUserProfile,
    );
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
      throw new Error("UserProfile create error");
    });

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("UserProfile create error");
    expect(UserProfileRepository.create).toHaveBeenCalled();
    expect(UserProfileRepository.save).not.toHaveBeenCalled();
    expect(UserRepository.create).not.toHaveBeenCalled();
    expect(UserRepository.save).not.toHaveBeenCalled();
  });

  it("propagates errors from create error", async () => {
    (UserProfileRepository.create as jest.Mock).mockRejectedValue(
      new Error("UserProfile create error"),
    );

    await expect(
      service.registerUser(
        basePayload,
        mockManager as unknown as EntityManager,
      ),
    ).rejects.toThrow("UserProfile create error");

    expect(UserProfileRepository.save).not.toHaveBeenCalledWith(
      mockUserProfile,
      mockManager as unknown as EntityManager,
    );
    expect(UserRepository.create).not.toHaveBeenCalled();
    expect(UserRepository.save).not.toHaveBeenCalled();
  });

  it("propagates errors from user saving", async () => {
    (UserProfileRepository.create as jest.Mock).mockReturnValue(
      mockUserProfile,
    );
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(
      mockUserProfile,
    );
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
    (UserProfileRepository.create as jest.Mock).mockReturnValue(
      mockUserProfile,
    );
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(
      mockUserProfile,
    );
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
    const regularUserProfile: UserProfile = {
      ...regularPayload,
    } as UserProfile;
    const regularUser: User = {
      ...regularPayload,
      id: 2,
      profile: regularUserProfile,
    } as User;

    (UserProfileRepository.create as jest.Mock).mockReturnValue(
      regularUserProfile,
    );
    (UserProfileRepository.save as jest.Mock).mockResolvedValue(
      regularUserProfile,
    );
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
        profile: regularUserProfile,
      },
      mockManager as unknown as EntityManager,
    );
    expect(result).toBe(regularUser);
  });
});
