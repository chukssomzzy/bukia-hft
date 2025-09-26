import { Request, Response } from "express";

import { IdempotencyRepository } from "../repositories";
import { IdempotentStatusType } from "../schema/idempotent.schema";

export class IdempotentServices {
  public async getStatus(key: string): Promise<IdempotentStatusType> {
    const rec = await IdempotencyRepository.findByKey(key);
    if (!rec) {
      return {
        completed: false,
        progress: 0,
        response: null,
        status: "pending",
      };
    }
    return {
      completed: rec.status === "completed",
      progress:
        rec.status === "processing" ? 50 : rec.status === "completed" ? 100 : 0,
      response: rec.response ?? null,
      status: rec.status,
    };
  }

  public async streamStatus(req: Request, res: Response): Promise<void> {
    const key = req.params.key as string;

    res.set({
      /* eslint-disable @typescript-eslint/naming-convention */
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    res.flushHeaders?.();

    let previous: null | string = null;

    const interval = setInterval(async () => {
      const status = await this.getStatus(key);
      const payload: IdempotentStatusType = {
        completed: status.completed ?? status.status === "completed",
        progress: status.progress,
        response: status.response ?? null,
        status: status.status,
      };

      const serialized = JSON.stringify(payload);
      if (previous !== serialized) {
        previous = serialized;
        res.write(`data: ${serialized}\n\n`);
      }

      if (payload.completed) {
        clearInterval(interval);
        res.write(`event: end\ndata: {}\n\n`);
        res.end();
      }
    }, 1000);

    req.on("close", () => {
      clearInterval(interval);
    });
  }
}

export const idempotentServices = new IdempotentServices();
