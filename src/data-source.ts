import "reflect-metadata";
import { DataSource } from "typeorm";

import config from "./config";
import log from "./utils/logger";

const isDevelopment = config.NODE_ENV === "development";

log.info(`Environment: ${config.NODE_ENV}`);
log.info(`Database: ${config.DB_NAME}`);
log.info(`DB HOST: ${config.DB_HOST}`);

const AppDataSource = new DataSource({
  database: config.DB_NAME,
  entities: isDevelopment ? ["src/models/**/*.ts"] : ["build/models/**/*.js"],
  host: config.DB_HOST,
  logging: isDevelopment,
  migrations: isDevelopment
    ? ["src/migrations/**/*.ts"]
    : ["build/migrations/**/*.js"],
  migrationsTableName: "migrations",
  password: config.DB_PASSWORD,
  port: Number(config.DB_PORT) || 5432,
  type: "postgres",
  username: config.DB_USER,
});

export async function initializeDataSource() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}

export default AppDataSource;
