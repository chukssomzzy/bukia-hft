import { NextFunction, Request, Response } from "express";

import { UserRole } from "../enums/user-roles";
import { adminUserServices } from "../services/admin-user.services";
import { RoleGuard } from "../utils/authorization";
import { sendJsonResponse } from "../utils/send-json-response";

/**
 * @openapi
 * tags:
 *   - name: AdminUser
 *     description: Admin user management endpoints. All endpoints require authentication and Admin role.
 *     x-roles:
 *       - ADMIN
 *     security:
 *       - bearerAuth: []
 */ export class AdminUserController {
  /**
   * @openapi
   * /admin/user/{userId}/deactivate:
   *   post:
   *     tags:
   *       - AdminUser
   *     summary: Deactivate a user account
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User deactivated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MeResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(req.params.id);
      await adminUserServices.deactivateUser(userId);
      sendJsonResponse(res, 200, "Deactivate User");
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/user/{userId}:
   *   get:
   *     tags:
   *       - AdminUser
   *     summary: Get a user by ID
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MeResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(req.params.id);
      const result = await adminUserServices.getUser(userId);
      sendJsonResponse(res, 201, "Get User", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/user/{userId}/transactions:
   *   get:
   *     tags:
   *       - AdminUser
   *     summary: Get a user's paginated transaction history (admin only)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *     responses:
   *       200:
   *         description: Paginated ledger entries
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedLedgerResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async getUserTransactions(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const userId = Number(req.params.id);
      const entries = await adminUserServices.getUserTransactions(
        userId,
        req.query,
      );
      sendJsonResponse(res, 200, "User transactions", entries);
    } catch (err) {
      next(err);
    }
  }

  @RoleGuard(UserRole.ADMIN)
  /**
   * @openapi
   * /admin/user/{userId}/wallets:
   *   get:
   *     tags:
   *       - AdminUser
   *     summary: Get all wallets for a user (admin only)
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: List of wallets for the user
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WalletListResponse'
   */
  public async getUserWallets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = Number(req.params.id);
      const wallets = await adminUserServices.getUserWallets(userId);
      sendJsonResponse(res, 200, "User wallets", wallets);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/users:
   *   get:
   *     tags:
   *       - AdminUser
   *     summary: List users with pagination and optional search
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of users
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AdminUserListResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminUserServices.listUsers(req.query);
      sendJsonResponse(res, 200, "Users list", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/user/{userId}/lock:
   *   post:
   *     tags:
   *       - AdminUser
   *     summary: Lock a user account
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User locked successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MeResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async lockUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminUserServices.lockUser(
        Number(req.params.id),
        req.body,
      );
      sendJsonResponse(res, 200, "lock user successfully", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/user/{userId}/reset-password:
   *   post:
   *     tags:
   *       - AdminUser
   *     summary: Reset a user's password
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AdminResetPasswordBody'
   *     responses:
   *       200:
   *         description: Password reset response
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AdminResetPasswordResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminUserServices.resetPassword(
        Number(req.params.id),
        req.body,
      );
      sendJsonResponse(res, 200, "User password resetted", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/user/{userId}/unlock:
   *   post:
   *     tags:
   *       - AdminUser
   *     summary: Unlock a user account
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User unlocked successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MeResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async unlockUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminUserServices.unlockUser(Number(req.params.id));
      sendJsonResponse(res, 200, "User unlocked successfully", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * @openapi
   * /admin/user/{userId}:
   *   patch:
   *     tags:
   *       - AdminUser
   *     summary: Update a user's details
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AdminUserEditBody'
   *     responses:
   *       200:
   *         description: Updated user details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MeResponse'
   */
  @RoleGuard(UserRole.ADMIN)
  public async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminUserServices.updateUser(req.user.id, req.body);
      sendJsonResponse(res, 200, "User updated successfully", result);
    } catch (err) {
      next(err);
    }
  }
}
