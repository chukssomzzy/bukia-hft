import { Router } from "express";

import analyticsController from "../controllers/analytics.controller";
import { auditMiddleware } from "../middleware/audit-log";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestQuery } from "../middleware/request-validation";
import { SystemSummaryQuerySchema, UserAnalyticsQuerySchema } from "../schema";

const analyticsRouter = Router();

analyticsRouter.get(
  "/",
  authenticateJWT,
  validateRequestQuery(UserAnalyticsQuerySchema),
  analyticsController.getUserAnalytics,
);

analyticsRouter.get(
  "/system/summary",
  authenticateJWT,
  validateRequestQuery(SystemSummaryQuerySchema),
  auditMiddleware("Viewed system summary"),
  analyticsController.getSystemSummary,
);

export default analyticsRouter;
