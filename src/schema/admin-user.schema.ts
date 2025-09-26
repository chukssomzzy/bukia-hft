import { z } from "zod";
import { PaginationQuerySchema } from "./index";
import { UserProfileSchema } from "./user-profile.schema";

/**
 * @openapi
 * components:
 *   schemas:
 *     AdminUserListQuery:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         pageSize:
 *           type: integer
 *           example: 10
 *         search:
 *           type: string
 *         role:
 *           type: string
 *           example: Admin
 *     AdminUserEditBody:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         country:
 *           type: string
 *         profile:
 *           $ref: '#/components/schemas/UserProfile'
 *     AdminResetPasswordBody:
 *       type: object
 *       required:
 *         - newPassword
 *       properties:
 *         newPassword:
 *           type: string
 *           minLength: 8
 */

export const AdminUserListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
  role: z.string().optional(),
});

export const AdminUserEditBodySchema = z.object({
  email: z.string().email().optional(),
  country: z.string().length(2).transform((s) => s.toUpperCase()).optional(),
  profile: UserProfileSchema.partial().optional(),
});

export const AdminResetPasswordBodySchema = z.object({
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

export type AdminUserListQueryType = z.infer<typeof AdminUserListQuerySchema>;
export type AdminUserEditBodyType = z.infer<typeof AdminUserEditBodySchema>;
export type AdminResetPasswordBodyType = z.infer<typeof AdminResetPasswordBodySchema>;
