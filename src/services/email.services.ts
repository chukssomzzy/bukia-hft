import { Queue } from "bullmq";

import { UserRole } from "../enums/user-roles";
import { AwsSesProvider } from "../providers";
import { UserRepository } from "../repositories/user.repository";
import { EmailTemplateMap, EmailTemplateName } from "../types/email.template";
import { renderTemplate } from "../utils/templates";
import { RedisService } from "./redis.services";

interface EmailJob {
  html: string;
  subject?: string;
  to: string;
}

class EmailService {
  private initializing: null | Promise<void> = null;
  private provider = new AwsSesProvider();
  private queue: null | Queue = null;

  public async close(): Promise<void> {
    if (!this.queue) return;
    try {
      await this.queue.close();
    } finally {
      this.queue = null;
    }
  }

  public async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }

  public async processJob(job: EmailJob): Promise<void> {
    await this.provider.send(job.to, job.html, job.subject);
  }

  public async send<K extends EmailTemplateName>(
    to: string,
    templateName: K,
    data: EmailTemplateMap[K],
    subject?: string,
    delaySeconds = 0,
  ): Promise<void> {
    const html = await renderTemplate(templateName, data);
    const queue = await this.getQueue();
    await queue.add(
      "send",
      { html, subject, to },
      {
        attempts: 5,
        backoff: { delay: 1000, type: "exponential" },
        delay: delaySeconds * 1000,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  public async sendToUsersByTypes<K extends EmailTemplateName>(
    userType: UserRole[],
    templateName: K,
    data: EmailTemplateMap[K],
    subject?: string,
    delaySeconds = 0,
  ): Promise<void> {
    const users = await UserRepository.findByTypes(userType);
    const recipients = users
      .map((u) => u.email)
      .filter((e): e is string => Boolean(e && e.trim()));

    if (recipients.length === 0) return;

    await Promise.all(
      recipients.map((to) =>
        this.send(to, templateName, data, subject, delaySeconds),
      ),
    );
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
      this.queue = new Queue("email", { connection });
    })();
    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }
}

export const emailService = new EmailService();
