import { HealthService } from "../../services/healthcheck.services";
/* eslint-disable @typescript-eslint/naming-convention */

jest.mock("../../services/redis.services", () => ({
  RedisService: { healthCheck: jest.fn().mockResolvedValue(true) },
}));
jest.mock("../../data-source", () => ({
  __esModule: true,
  default: {
    getRepository: jest
      .fn()
      .mockReturnValue({ extend: jest.fn().mockReturnValue({}) }),
    query: jest.fn().mockResolvedValue([1]),
  },
}));

jest.mock("../../services/email.services", () => ({
  emailService: { healthCheck: jest.fn().mockResolvedValue(true) },
}));

describe("HealthService.healthCheck", () => {
  let redisCheck: jest.SpyInstance;
  let postgresCheck: jest.SpyInstance;

  beforeEach(() => {
    (
      HealthService as unknown as {
        registered: Array<{ check: () => Promise<boolean>; name: string }>;
      }
    ).registered = [
      { check: jest.fn(), name: "redis" },
      { check: jest.fn(), name: "postgres" },
    ];

    redisCheck = jest.spyOn(HealthService["registered"][0], "check");
    postgresCheck = jest.spyOn(HealthService["registered"][1], "check");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should call all registered service health checks", async () => {
    redisCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);

    await HealthService.healthCheck();

    expect(redisCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
  });

  test("should return all healthy when all services are healthy", async () => {
    redisCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: true, service: "redis" },
      { healthy: true, service: "postgres" },
    ]);
  });

  test("should return unhealthy for a failing service and introspect call order", async () => {
    redisCheck.mockResolvedValue(true);
    postgresCheck.mockResolvedValue(false);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: true, service: "redis" },
      { healthy: false, service: "postgres" },
    ]);
    expect(redisCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
  });

  test("should handle exceptions and mark service as unhealthy", async () => {
    redisCheck.mockRejectedValue(new Error("Redis error"));
    postgresCheck.mockResolvedValue(true);

    const result = await HealthService.healthCheck();
    expect(result).toEqual([
      { healthy: false, service: "redis" },
      { healthy: true, service: "postgres" },
    ]);
    expect(redisCheck).toHaveBeenCalled();
    expect(postgresCheck).toHaveBeenCalled();
  });
});
