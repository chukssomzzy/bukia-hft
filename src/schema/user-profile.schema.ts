import { z } from "zod";
/**
 * @openapi
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         dob:
 *           type: string
 *           format: date
 */
export const UserProfileSchema = z.object({
  firstName: z.string().optional().nullable(),
  id: z.number(),
  lastName: z.string().nullable(),
});

export type UserProfileType = z.infer<typeof UserProfileSchema>;
