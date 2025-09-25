import AppDataSource from "../data-source";
import { RedisService } from "./redis.services";

export interface ServiceHealthStatus {
  healthy: boolean;
  service: string;
}

export class HealthService {
  private static registered = [
    { check: () => RedisService.healthCheck(), name: "redis" },
    {
      check: async () => {
        try {
          await AppDataSource.query("SELECT 1");
          return true;
        } catch {
          return false;
        }
      },
      name: "postgres",
    },
  ];

  public static async healthCheck(): Promise<ServiceHealthStatus[]> {
    const results: ServiceHealthStatus[] = [];
    for (const svc of HealthService.registered) {
      try {
        const healthy = await svc.check();
        results.push({ healthy, service: svc.name });
      } catch {
        results.push({ healthy: false, service: svc.name });
      }
    }
    return results;
  }
}
