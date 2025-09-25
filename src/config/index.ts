import dotenv from "dotenv";

dotenv.config();

const config = {
  ACCESS_TOKEN_EXPIRY: Number(process.env.ACCESS_TOKEN_EXPIRY),
  ALLOWED_HOSTS: process.env.ALLOWED_HOSTS,
  BASE_URL: process.env.BASE_URL,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  NODE_ENV: process.env.NODE_ENV,
  OTP_TTL_SEC: Number(process.env.OTP_TTL_SEC || "600"),
  PORT: process.env.PORT ?? 8000,
  REFRESH_TOKEN_EXPIRY: Number(process.env.REFRESH_TOKEN_EXPIRY),
  SWAGGER_JSON_URL: process.env.SWAGGER_JSON_URL,
  TOKEN_SECRET: process.env.APP_SECRET,
} as const;

export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST,
  password: process.env.REDIS_PASSWORD || undefined,
  port: Number(process.env.REDIS_PORT) || 6379,
  username: process.env.REDIS_USER || undefined,
} as const;

export default config;
