import AppDataSource from "../data-source";
import { RedisService } from "../services/redis.services";
import log from "../utils/logger";
export const connection = RedisService.duplicate();

// import "./email.worker";

if (!AppDataSource.isInitialized) {
  AppDataSource.initialize().then(() => log.info("App data source intialized"));
}

process.on("exit", () => {
  connection.quit().catch((err) => {
    log.error({ error: err, event: "redis_quit_error_on_exit" });
  });
});
process.on("SIGINT", () => {
  connection
    .quit()
    .catch((err) => {
      log.error({ error: err, event: "redis_quit_error_on_sigint" });
    })
    .finally(() => {
      process.exit();
    });
});
process.on("SIGTERM", () => {
  connection
    .quit()
    .catch((err) => {
      log.error({ error: err, event: "redis_quit_error_on_sigterm" });
    })
    .finally(() => {
      process.exit();
    });
});

log.info({ event: "all_workers_started" });
