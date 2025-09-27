import { NextFunction, Request, Response } from "express";

import { UserRole } from "../enums/user-roles";
import { adminAuditLogService } from "../services/audit-log.services";

export function auditMiddleware(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      req.user?.role === UserRole.ADMIN ||
      req.user?.role === UserRole.SUPER_ADMIN
    ) {
      const log = {
        action,
        adminUserId: req.user.id,
        details: {
          body: req.body,
          method: req.method,
          path: req.path,
          query: req.query,
        },
        ipAddress: req.ip,
        targetUserId: req.body?.userId || req.params?.userId,
        timestamp: new Date().toISOString(),
      };
      adminAuditLogService.addLog(log);
    }
    next();
  };
}
