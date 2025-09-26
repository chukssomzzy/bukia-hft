import { Job, Worker } from "bullmq";

import config from "../config";
import { IdempotencyRepository } from "../repositories";
import { TransferRequestType } from "../schema/transfer.schema";
import { RedisService } from "../services/redis.services";
import { transferService } from "../services/transfer.services";
import log from "../utils/logger";

const connection = RedisService.duplicate();

const worker = new Worker<TransferRequestType>(
  "transfers",
  async (job: Job<TransferRequestType & { userId: number }>) =>
    transferService.process(job.data),
  { concurrency: config.WORKER_CONCURRENCY, connection },
);

worker.on("failed", async (job, err) => {
  log.error({
    error: err?.message,
    event: "transfer_job_failed",
    jobId: job?.id,
  });

  const payload = job.data;
  await transferService.sendTransferStatusEmail(
    payload as TransferRequestType & { userId: number },
    "failed",
    err.message,
  );
  await IdempotencyRepository.markAsFailed(payload.idempotencyKey, err.message);
});

worker.on("completed", (job) => {
  log.info({ event: "transfer_job_completed", jobId: job.id });
});

export default worker;
