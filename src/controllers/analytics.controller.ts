import { NextFunction, Request, Response } from "express";

import { UserRole } from "../enums/user-roles";
import { analyticsServices } from "../services/analytics.services";
import { RoleGuard } from "../utils/authorization";
import { sendJsonResponse } from "../utils/send-json-response";

class AnalyticsController {
  /**
   * @openapi
   * /analytics/system/summary:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get system-wide financial summary (admin only)
   *     parameters:
   *       - in: query
   *         name: currency
   *         schema:
   *           $ref: '#/components/schemas/UserAnalyticsQuery/properties/currency'
   *         required: false
   *         description: Base currency to convert totals into
   *     responses:
   *       200:
   *         description: System summary
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SystemSummaryResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async getSystemSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const data = await analyticsServices.getSystemSummary(
        String(req.query.currency),
      );
      return sendJsonResponse(res, 200, "System summary", data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /analytics:
   *   get:
   *     summary: Get analytics for a user
   *     parameters:
   *       - in: query
   *         name: currency
   *         schema:
   *           $ref: '#/components/schemas/UserAnalyticsQuery/properties/currency'
   *         required: false
   *         description: The currency code to use for analytics (e.g., "USD", "NGN"). If not provided, defaults to "USD".
   *     responses:
   *       200:
   *         description: User analytics data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UserAnalyticsResponse'
   */
  public async getUserAnalytics(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const data = await analyticsServices.getUserAnalytics(
        req.user.id,
        String(req.query.currency),
      );
      return sendJsonResponse(res, 200, "User analytics", data);
    } catch (err) {
      next(err);
    }
  }
}

export default new AnalyticsController();
