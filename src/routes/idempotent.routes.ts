import { Router } from "express";

import { IdempotentController } from "../controllers/idempotent.controller";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestParams } from "../middleware/request-validation";
import { IdempotentParamsSchema } from "../schema/idempotent.schema";

const router = Router();
const controller = new IdempotentController();

router.get(
  "/:key/stream",
  authenticateJWT,
  validateRequestParams(IdempotentParamsSchema),
  controller.stream,
);

export default router;
