import { Router } from "express";

import analyticsController from "../controllers/analytics.controller";
import { authenticateJWT } from "../middleware/auth";
import { validateRequestQuery } from "../middleware/request-validation";
import { UserAnalyticsQuerySchema } from "../schema";

const analyticsRouter = Router();

analyticsRouter.get(
  "/",
  authenticateJWT,
  validateRequestQuery(UserAnalyticsQuerySchema),
  analyticsController.getUserAnalytics,
);

export default analyticsRouter;
