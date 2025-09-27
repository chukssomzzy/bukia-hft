import { z } from "zod";

import { UserProfileSchema } from "./user-profile.schema";

export const USER_TYPE = ["User", "Admin", "Superadmin"] as const;

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: number
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         isverified:
 *           type: boolean
 *         type:
 *           type: string
 *           enum: [user, admin, business]
 */
export const UserSchema = z.object({
  createdAt: z.date(),
  email: z.string().nullable(),
  id: z.number(),
  isverified: z.boolean(),
  profile: UserProfileSchema.nullable(),
  type: z.enum(USER_TYPE),
});

export const RegularUserSchema = UserSchema.extend({
  type: z.literal(USER_TYPE[0]),
});

export type UserType = z.infer<typeof UserSchema>;
