import { Job, Queue } from "bullmq";

import AppDataSource from "../data-source";
import { AdminAuditLog } from "../models";
import { RedisService } from "./redis.services";

class AdminAuditLogService {
  private initializing: null | Promise<void> = null;
  private queue: null | Queue = null;

  public async addLog(
    log: Partial<AdminAuditLog>,
    delaySeconds = 0,
  ): Promise<void> {
    const queue = await this.getQueue();
    await queue.add("admin_audit_log", log, {
      attempts: 5,
      backoff: { delay: 1000, type: "exponential" },
      delay: delaySeconds * 1000,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  public async close(): Promise<void> {
    if (!this.queue) return;
    try {
      await this.queue.close();
    } finally {
      this.queue = null;
    }
  }

  public async processJob(job: Job): Promise<void> {
    const log = job.data;
    await AppDataSource.getRepository(AdminAuditLog).insert({
      action: log.action,
      adminUserId: log.adminUserId,
      details: log.details,
      ipAddress: log.ipAddress,
      targetUserId: log.targetUserId,
      timestamp: log.timestamp,
    });
  }

  private async getQueue(): Promise<Queue> {
    await this.initQueue();
    return this.queue as Queue;
  }

  private async initQueue(): Promise<void> {
    if (this.queue) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async (): Promise<void> => {
      const connection = RedisService.duplicate();
      this.queue = new Queue("admin_audit_log", { connection });
    })();
    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }
}

export const adminAuditLogService = new AdminAuditLogService();
