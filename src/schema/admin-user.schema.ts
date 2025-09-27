import { z } from "zod";

import { MeResponseSchema, PaginationQuerySchema } from "./index";
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
  role: z.string().optional(),
  search: z.string().optional(),
});

export const AdminUserEditBodySchema = z.object({
  email: z.string().email().optional(),
  profile: UserProfileSchema.partial().optional(),
});

export const AdminLockOutUserRequestSchema = z.object({
  numberOfMinsToLockUser: z.number().default(30),
});

export const AdminResetPasswordBodySchema = z.object({
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/)
    .optional(),
});

export const AdminUserListResponseSchema = z.object({
  items: z.array(MeResponseSchema.nullable()).nullable(),
  page: z.number().nullable(),
  pageSize: z.number().nullable(),
  total: z.number().nullable(),
});

export const AdminResetPasswordResponseSchema = z.object({
  tempPassword: z.string().optional(),
});

export type AdminLockOutUserRequestType = z.infer<
  typeof AdminLockOutUserRequestSchema
>;
export type AdminResetPasswordBodyType = z.infer<
  typeof AdminResetPasswordBodySchema
>;
export type AdminResetPasswordResponseType = z.infer<
  typeof AdminResetPasswordResponseSchema
>;

export type AdminUserEditBodyType = z.infer<typeof AdminUserEditBodySchema>;
export type AdminUserListQueryType = z.infer<typeof AdminUserListQuerySchema>;
export type AdminUserListResponseType = z.infer<
  typeof AdminUserListResponseSchema
>;
