import Redis, { Redis as RedisClient, RedisOptions } from "ioredis";

import { REDIS_CONFIG } from "../config";

export class RedisService {
  private static client: null | RedisClient = null;
  private static options: RedisOptions | undefined;

  public static configure(options: RedisOptions): void {
    this.options = {
      ...options,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    };
  }

  public static async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } finally {
        this.client = null;
      }
    }
  }

  public static duplicate(): RedisClient {
    return this.getClient().duplicate(this.options);
  }

  public static getClient: () => RedisClient = () => {
    if (!this.client) {
      this.client = new Redis(
        this.options ?? { enableReadyCheck: false, maxRetriesPerRequest: null },
      );
    }
    return this.client as RedisClient;
  };

  public static async healthCheck(): Promise<boolean> {
    try {
      const res = await this.getClient().ping();
      return res === "PONG";
    } catch {
      return false;
    }
  }
}

RedisService.configure(REDIS_CONFIG);
