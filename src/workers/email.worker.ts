import { Worker } from "bullmq";

import { connection } from ".";
import config from "../config";
import { emailService } from "../services/email.services";
import log from "../utils/logger";

const worker = new Worker(
  "email",
  async (job) => {
    await emailService.processJob(job.data);
  },
  { concurrency: config.WORKER_CONCURRENCY, connection },
);

worker.on("failed", (job, err) => {
  log.error({ error: err.message, event: "email_job_failed", jobId: job?.id });
});

worker.on("completed", (job) => {
  log.info({ event: "email_job_worker_completed", jobId: job.id });
});
