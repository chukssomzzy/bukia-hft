import { z } from "zod";

export const USER_TYPE = ["user", "admin", "business"] as const;

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
  email: z.string(),
  id: z.number(),
  isverified: z.boolean(),
  phone: z.string(),
  type: z.enum(USER_TYPE),
});

export type UserType = z.infer<typeof UserSchema>;
