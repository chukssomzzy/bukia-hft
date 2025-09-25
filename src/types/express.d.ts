import type { JWTUserPayloadType } from "../schema";

declare module "express-serve-static-core" {
  interface Request {
    user?: JWTUserPayloadType;
  }
}
