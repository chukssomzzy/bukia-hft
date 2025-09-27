import { Job, Worker } from "bullmq";

import { connection } from ".";
import config from "../config";
import { adminAuditLogService } from "../services/audit-log.services";
import log from "../utils/logger";

const worker = new Worker(
  "admin_audit_log",
  async (job: Job) => await adminAuditLogService.processJob(job),
  {
    concurrency: config.WORKER_CONCURRENCY,
    connection,
  },
);

worker.on("failed", (job, err) => {
  log.error({
    error: err.message,
    event: "admin_audit_log_job_failed",
    jobId: job?.id,
  });
});

worker.on("completed", (job) => {
  log.info({ event: "admin_audit_log_job_worker_completed", jobId: job.id });
});
