import { RateLimitError } from "../../middleware";
import { RedisService } from "../../services/redis.services";
import { RateLimitByKey, RateLimitOptions } from "../../utils";

jest.mock("../../services/redis.services");
jest.mock("../../middleware", () => ({
  RateLimitError: jest
    .fn()
    .mockImplementation((message: string, retryAfter: number) => {
      const error = new Error(message);
      error.name = "RateLimitError";
      (error as Error & { retryAfter: number }).retryAfter = retryAfter;
      return error;
    }),
}));

describe("RateLimitByKey decorator", () => {
  let mockRedisClient: {
    eval: jest.Mock;
    ttl: jest.Mock;
  };
  let mockTarget: object;
  let mockDescriptor: TypedPropertyDescriptor<
    (...args: ReadonlyArray<unknown>) => Promise<unknown>
  >;
  let originalMethod: jest.Mock<Promise<string>, [string]>;

  beforeEach(() => {
    mockRedisClient = {
      eval: jest.fn(),
      ttl: jest.fn(),
    };
    (RedisService.getClient as jest.Mock).mockReturnValue(mockRedisClient);

    mockTarget = {};
    originalMethod = jest.fn<Promise<string>, [string]>();
    mockDescriptor = {
      value: originalMethod,
    };

    jest.clearAllMocks();
  });

  describe("decorator application", () => {
    it("should modify the descriptor value with decorated method", () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      expect(mockDescriptor.value).not.toBe(originalMethod);
      expect(typeof mockDescriptor.value).toBe("function");
    });

    it("should preserve original method functionality when rate limit not exceeded", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      const expectedResult = "method result";
      originalMethod.mockResolvedValue(expectedResult);
      mockRedisClient.eval.mockResolvedValue(3);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      const result = await mockDescriptor.value!("test@example.com");

      expect(result).toBe(expectedResult);
      expect(originalMethod).toHaveBeenCalledWith("test@example.com");
    });
  });

  describe("rate limiting logic", () => {
    it("should allow request when count is within limit", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      originalMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(3);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      const result = await mockDescriptor.value!("test@example.com");

      expect(result).toBe("success");
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("INCR", KEYS[1])'),
        1,
        "rl:test@example.com",
        "60",
      );
    });

    it("should allow request when count equals max limit", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      originalMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(5);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      const result = await mockDescriptor.value!("test@example.com");

      expect(result).toBe("success");
      expect(originalMethod).toHaveBeenCalledWith("test@example.com");
    });

    it("should throw RateLimitError when count exceeds limit", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      mockRedisClient.eval.mockResolvedValue(6);
      mockRedisClient.ttl.mockResolvedValue(45);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 45 second(s).",
      );
      expect(mockRedisClient.ttl).toHaveBeenCalledWith("rl:test@example.com");
      expect(originalMethod).not.toHaveBeenCalled();
    });

    it("should use TTL as retry after when TTL is positive", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 3,
        windowSec: 120,
      };
      mockRedisClient.eval.mockResolvedValue(5);
      mockRedisClient.ttl.mockResolvedValue(75);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 75 second(s).",
      );
      expect(RateLimitError).toHaveBeenCalledWith(
        "Too many requests. Please try again in 75 second(s).",
        75,
      );
    });

    it("should use windowSec as retry after when TTL is zero", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 3,
        windowSec: 120,
      };
      mockRedisClient.eval.mockResolvedValue(5);
      mockRedisClient.ttl.mockResolvedValue(0);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 120 second(s).",
      );
      expect(RateLimitError).toHaveBeenCalledWith(
        "Too many requests. Please try again in 120 second(s).",
        120,
      );
    });

    it("should use windowSec as retry after when TTL is negative", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 2,
        windowSec: 90,
      };
      mockRedisClient.eval.mockResolvedValue(4);
      mockRedisClient.ttl.mockResolvedValue(-1);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 90 second(s).",
      );
      expect(RateLimitError).toHaveBeenCalledWith(
        "Too many requests. Please try again in 90 second(s).",
        90,
      );
    });
  });

  describe("key generation", () => {
    it("should use custom prefix when provided", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        prefix: "custom",
        windowSec: 60,
      };
      originalMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(1);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await mockDescriptor.value!("test@example.com");

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("INCR", KEYS[1])'),
        1,
        "custom:test@example.com",
        "60",
      );
    });

    it("should use default prefix 'rl' when not provided", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      originalMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(1);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await mockDescriptor.value!("test@example.com");

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("INCR", KEYS[1])'),
        1,
        "rl:test@example.com",
        "60",
      );
    });

    it("should call keySelector with correct arguments", async () => {
      const keySelector = jest
        .fn<string, [string, string, number]>()
        .mockReturnValue("derived-key");
      const options: RateLimitOptions<
        jest.Mock<Promise<string>, [string, string, number]>
      > = {
        keySelector,
        max: 5,
        windowSec: 60,
      };
      const multiArgMethod = jest.fn<
        Promise<string>,
        [string, string, number]
      >();
      multiArgMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(1);

      const multiArgDescriptor: TypedPropertyDescriptor<typeof multiArgMethod> =
        {
          value: multiArgMethod,
        };

      RateLimitByKey(options)(mockTarget, "testMethod", multiArgDescriptor);

      await multiArgDescriptor.value!("arg1", "arg2", 123);

      expect(keySelector).toHaveBeenCalledWith("arg1", "arg2", 123);
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("INCR", KEYS[1])'),
        1,
        "rl:derived-key",
        "60",
      );
    });
  });

  describe("custom error messages", () => {
    it("should use custom message when provided", async () => {
      const customMessage = "Custom rate limit exceeded";
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 3,
        message: customMessage,
        windowSec: 60,
      };
      mockRedisClient.eval.mockResolvedValue(5);
      mockRedisClient.ttl.mockResolvedValue(30);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        customMessage,
      );
      expect(RateLimitError).toHaveBeenCalledWith(customMessage, 30);
    });

    it("should use default message when not provided", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 3,
        windowSec: 60,
      };
      mockRedisClient.eval.mockResolvedValue(5);
      mockRedisClient.ttl.mockResolvedValue(30);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 30 second(s).",
      );
      expect(RateLimitError).toHaveBeenCalledWith(
        "Too many requests. Please try again in 30 second(s).",
        30,
      );
    });
  });

  describe("Lua script execution", () => {
    it("should execute correct Lua script for rate limiting", async () => {
      const options: RateLimitOptions<jest.Mock<Promise<string>, [string]>> = {
        keySelector: (id: string) => id,
        max: 10,
        windowSec: 300,
      };
      const idMethod = jest.fn<Promise<string>, [string]>();
      idMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(7);

      const idDescriptor: TypedPropertyDescriptor<typeof idMethod> = {
        value: idMethod,
      };

      RateLimitByKey(options)(mockTarget, "testMethod", idDescriptor);

      await idDescriptor.value!("user123");

      const expectedScript = expect.stringMatching(
        /local current = redis\.call\("INCR", KEYS\[1\]\)[\s\S]*if current == 1 then[\s\S]*redis\.call\("EXPIRE", KEYS\[1\], ARGV\[1\]\)[\s\S]*end[\s\S]*return current/,
      );
      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expectedScript,
        1,
        "rl:user123",
        "300",
      );
    });

    it("should handle Redis eval errors", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      const redisError = new Error("Redis connection failed");
      mockRedisClient.eval.mockRejectedValue(redisError);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Redis connection failed",
      );
      expect(originalMethod).not.toHaveBeenCalled();
    });

    it("should handle TTL query errors gracefully", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 3,
        windowSec: 60,
      };
      mockRedisClient.eval.mockResolvedValue(5);
      mockRedisClient.ttl.mockRejectedValue(new Error("TTL query failed"));

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "TTL query failed",
      );
    });
  });

  describe("original method error propagation", () => {
    it("should propagate errors from original method", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 5,
        windowSec: 60,
      };
      const originalError = new Error("Original method failed");
      originalMethod.mockRejectedValue(originalError);
      mockRedisClient.eval.mockResolvedValue(2);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Original method failed",
      );
      expect(originalMethod).toHaveBeenCalledWith("test@example.com");
    });

    it("should return original method result when successful", async () => {
      const options: RateLimitOptions<
        jest.Mock<Promise<{ data: string; success: boolean }>, [number]>
      > = {
        keySelector: (userId: number) => userId.toString(),
        max: 5,
        windowSec: 60,
      };
      const expectedResult = { data: "test", success: true };
      const numberMethod = jest.fn<
        Promise<{ data: string; success: boolean }>,
        [number]
      >();
      numberMethod.mockResolvedValue(expectedResult);
      mockRedisClient.eval.mockResolvedValue(1);

      const numberDescriptor: TypedPropertyDescriptor<typeof numberMethod> = {
        value: numberMethod,
      };

      RateLimitByKey(options)(mockTarget, "testMethod", numberDescriptor);

      const result = await numberDescriptor.value!(123);

      expect(result).toEqual(expectedResult);
      expect(numberMethod).toHaveBeenCalledWith(123);
    });
  });

  describe("edge cases", () => {
    it("should handle zero max limit", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 0,
        windowSec: 60,
      };
      mockRedisClient.eval.mockResolvedValue(1);
      mockRedisClient.ttl.mockResolvedValue(45);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 45 second(s).",
      );
      expect(originalMethod).not.toHaveBeenCalled();
    });

    it("should handle very large count values", async () => {
      const options: RateLimitOptions<typeof originalMethod> = {
        keySelector: (email: string) => email,
        max: 1000,
        windowSec: 60,
      };
      mockRedisClient.eval.mockResolvedValue(999999);
      mockRedisClient.ttl.mockResolvedValue(30);

      RateLimitByKey(options)(
        mockTarget,
        "testMethod",
        mockDescriptor as unknown,
      );

      await expect(mockDescriptor.value!("test@example.com")).rejects.toThrow(
        "Too many requests. Please try again in 30 second(s).",
      );
      expect(RateLimitError).toHaveBeenCalledWith(
        "Too many requests. Please try again in 30 second(s).",
        30,
      );
    });

    it("should handle empty string key", async () => {
      const options: RateLimitOptions<jest.Mock<Promise<string>, [string]>> = {
        keySelector: () => "",
        max: 5,
        windowSec: 60,
      };
      const emptyKeyMethod = jest.fn<Promise<string>, [string]>();
      emptyKeyMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(1);

      const emptyKeyDescriptor: TypedPropertyDescriptor<typeof emptyKeyMethod> =
        {
          value: emptyKeyMethod,
        };

      RateLimitByKey(options)(mockTarget, "testMethod", emptyKeyDescriptor);

      await emptyKeyDescriptor.value!("test");

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("INCR", KEYS[1])'),
        1,
        "rl:",
        "60",
      );
    });

    it("should handle multiple arguments correctly", async () => {
      interface ComplexObject {
        nested: string;
      }

      const keySelector = jest
        .fn<string, [string, number, ComplexObject, number[]]>()
        .mockReturnValue("multi-arg-key");
      const complexMethod = jest.fn<
        Promise<string>,
        [string, number, ComplexObject, number[]]
      >();
      const options: RateLimitOptions<typeof complexMethod> = {
        keySelector,
        max: 5,
        windowSec: 60,
      };
      complexMethod.mockResolvedValue("success");
      mockRedisClient.eval.mockResolvedValue(1);

      const complexDescriptor: TypedPropertyDescriptor<typeof complexMethod> = {
        value: complexMethod,
      };

      RateLimitByKey(options)(mockTarget, "testMethod", complexDescriptor);

      await complexDescriptor.value!(
        "arg1",
        42,
        { nested: "object" },
        [1, 2, 3],
      );

      expect(keySelector).toHaveBeenCalledWith(
        "arg1",
        42,
        { nested: "object" },
        [1, 2, 3],
      );
      expect(complexMethod).toHaveBeenCalledWith(
        "arg1",
        42,
        { nested: "object" },
        [1, 2, 3],
      );
    });
  });
});
