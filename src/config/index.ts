import dotenv from "dotenv";

dotenv.config();

const config = {
  ACCESS_TOKEN_EXPIRY: Number(process.env.ACCESS_TOKEN_EXPIRY),
  ALLOWED_HOSTS: process.env.ALLOWED_HOSTS,
  AWS_REGION: process.env.AWS_REGION ?? "us-east-1",
  BASE_URL: process.env.BASE_URL,
  CURRENCY_CONVERTION_API_URL: String(
    process.env.CURRENCY_CONVERTION_API_URL ??
      "https://api.frankfurter.app/latest",
  ),
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  EMAIL_FROM: process.env.EMAIL_FROM ?? "noreply@bukiagold.co",
  EXCHANGE_RATES_APP_ID: process.env.EXCHANGE_RATES_APP_ID,
  NODE_ENV: process.env.NODE_ENV,
  OTP_TTL_SEC: Number(process.env.OTP_TTL_SEC || "600"),
  PORT: process.env.PORT ?? 8000,
  REFRESH_TOKEN_EXPIRY: Number(process.env.REFRESH_TOKEN_EXPIRY),
  SWAGGER_JSON_URL: process.env.SWAGGER_JSON_URL,
  TEMPLATE_PATH: process.env.TEMPLATE_PATH || "../views/email/templates",
  TOKEN_SECRET: process.env.APP_SECRET,
  TRANSFER_BACKOFF_MS: Number(process.env.TRANSFER_BACKOFF_MS ?? "1000"),
  TRANSFER_OPTIMISTIC_RETRIES: Number(
    process.env.TRANSFER_OPTIMISTIC_RETRIES ?? "0",
  ),
  TRANSFER_RETRY_LIMIT: Number(process.env.TRANSFER_RETRY_LIMIT ?? "0"),
  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY ?? "5"),
} as const;

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD || undefined,
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USER || undefined,
} as const;

export const AWS_CONFIG = {
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: config.AWS_REGION,
} as const;

export default config;
