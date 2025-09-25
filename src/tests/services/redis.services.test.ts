import Redis, { Redis as RedisClient, RedisOptions } from "ioredis";

import { RedisService } from "../../services/redis.services";

jest.mock("ioredis");

describe("RedisService", () => {
  let mockRedisInstance: RedisClient;

  beforeEach(() => {
    mockRedisInstance = {
      duplicate: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue("PONG"),
        quit: jest.fn().mockResolvedValue("OK"),
      } as unknown as RedisClient),
      ping: jest.fn().mockResolvedValue("PONG"),
      quit: jest.fn().mockResolvedValue("OK"),
    } as unknown as RedisClient;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);
    // Reset static client
    (RedisService as unknown as { client: null | RedisClient }).client = null;
    jest.clearAllMocks();
  });

  it("should configure options and create client", () => {
    const options: RedisOptions = { host: "localhost", port: 6379 };
    RedisService.configure(options);
    const client = RedisService.getClient();
    expect(client).toBe(mockRedisInstance);
  });

  it("should reuse existing client", () => {
    RedisService.getClient();
    const client2 = RedisService.getClient();
    expect(client2).toBe(mockRedisInstance);
    expect(Redis).toHaveBeenCalledTimes(1);
  });

  it("should disconnect and reset client", async () => {
    RedisService.getClient();
    await RedisService.disconnect();
    expect(mockRedisInstance.quit).toHaveBeenCalled();
    expect(
      (RedisService as unknown as { client: null | RedisClient }).client,
    ).toBeNull();
  });

  it("should duplicate client with options", () => {
    RedisService.getClient();
    const duplicate = RedisService.duplicate();
    expect(mockRedisInstance.duplicate).toHaveBeenCalledWith(
      RedisService["options"],
    );
    expect(duplicate).toHaveProperty("ping");
  });

  it("should return true for healthy ping", async () => {
    RedisService.getClient();
    const result = await RedisService.healthCheck();
    expect(result).toBe(true);
    expect(mockRedisInstance.ping).toHaveBeenCalled();
  });

  it("should return false for unhealthy ping", async () => {
    (mockRedisInstance.ping as jest.Mock).mockRejectedValueOnce(
      new Error("fail"),
    );
    RedisService.getClient();
    const result = await RedisService.healthCheck();
    expect(result).toBe(false);
  });

  it("should fallback to default options if not configured", () => {
    (RedisService as unknown as { options: RedisOptions | undefined }).options =
      undefined;
    RedisService.getClient();
    expect(Redis).toHaveBeenCalledWith(
      expect.objectContaining({
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      }),
    );
  });
});
