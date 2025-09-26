import { NextFunction, Request, Response } from "express";

import { analyticsServices } from "../services/analytics.services";
import { sendJsonResponse } from "../utils/send-json-response";

class AnalyticsController {
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
  getUserAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await analyticsServices.getUserAnalytics(
        req.user.id,
        String(req.query.currency),
      );
      return sendJsonResponse(res, 200, "User analytics", data);
    } catch (err) {
      next(err);
    }
  };
}

export default new AnalyticsController();
