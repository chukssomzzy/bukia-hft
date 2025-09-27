import { Router } from "express";

import { AdminUserController } from "../controllers/admin-user.controller";
import { auditMiddleware } from "../middleware/audit-log";
import { authenticateJWT } from "../middleware/auth";
import {
  validateRequestBody,
  validateRequestParams,
  validateRequestQuery,
} from "../middleware/request-validation";
import { IdParamSchema, PaginationQuerySchema } from "../schema";
import {
  AdminLockOutUserRequestSchema,
  AdminResetPasswordBodySchema,
  AdminUserEditBodySchema,
  AdminUserListQuerySchema,
} from "../schema/admin-user.schema";

const adminUserController = new AdminUserController();
const adminUserRouter = Router();

adminUserRouter.use(authenticateJWT);

adminUserRouter.post(
  "/user/:id/deactivate",
  validateRequestParams(IdParamSchema),
  auditMiddleware("deactivated a user"),
  adminUserController.deactivateUser,
);

adminUserRouter.get(
  "/user/:id",
  validateRequestParams(IdParamSchema),
  auditMiddleware("Got a user information"),
  adminUserController.getUser,
);

adminUserRouter.get(
  "/user/:id/transactions",
  validateRequestParams(IdParamSchema),
  validateRequestQuery(PaginationQuerySchema),
  auditMiddleware("Read a user's transactions"),
  adminUserController.getUserTransactions,
);

adminUserRouter.get(
  "/user/:id/wallets",
  validateRequestParams(IdParamSchema),
  auditMiddleware("Read a user's wallets"),
  adminUserController.getUserWallets,
);

adminUserRouter.get(
  "/users",
  validateRequestQuery(AdminUserListQuerySchema),
  auditMiddleware("Paginated and read all users"),
  adminUserController.listUsers,
);

adminUserRouter.post(
  "/user/:id/lock",
  validateRequestParams(IdParamSchema),
  validateRequestBody(AdminLockOutUserRequestSchema),
  auditMiddleware("Locked a user account"),
  adminUserController.lockUser,
);

adminUserRouter.post(
  "/user/:id/unlock",
  validateRequestParams(IdParamSchema),
  auditMiddleware("Unlocked a user"),
  adminUserController.unlockUser,
);

adminUserRouter.post(
  "/user/:id/reset-password",
  validateRequestParams(IdParamSchema),
  validateRequestBody(AdminResetPasswordBodySchema),
  auditMiddleware("Reset a user password"),
  adminUserController.resetPassword,
);
adminUserRouter.patch(
  "/user/:id",
  validateRequestParams(IdParamSchema),
  validateRequestBody(AdminUserEditBodySchema),
  auditMiddleware("Update a user information"),
  adminUserController.updateUser,
);

export default adminUserRouter;
