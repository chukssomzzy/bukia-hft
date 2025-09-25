import { z } from "zod";

import { AdminSchema } from "./admin.schema";
export const USER_TYPE = ["user", "admin", "business", "superadmin"] as const;
export const JWT_TYPE = ["access", "refresh"] as const;

/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterUserRequest:
 *       type: object
 *       required:
 *         - dob
 *         - email
 *         - firstName
 *         - lastName
 *         - password
 *         - phoneNumber
 *       properties:
 *         dob:
 *           type: string
 *           format: date
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         password:
 *           type: string
 *           description: Strong password (min 8 chars, upper/lowercase, digit, special char)
 *         phone:
 *           type: string
 *           description: International format (e.g. +123456789)
 *         type:
 *           type: string
 *           enum: [user, admin, business]
 *           default: user
 *     RegisterUserResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         status:
 *           type: integer
 *         success:
 *           type: boolean
 *     LoginUserRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *     LoginUserResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *         refreshToken:
 *           type: string
 *         role:
 *           type: string
 *           enum: [user, admin, business]
 *     MeResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *         type:
 *           type: string
 *           enum: [user, admin, business]
 *         profile:
 *           oneOf:
 *             - $ref: '#/components/schemas/UserProfile'
 *             - allOf:
 *                 - $ref: '#/components/schemas/UserProfile'
 *                 - $ref: '#/components/schemas/BusinessProfile'
 *
 *     JWTRefreshRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: JWT refresh token
 *     JWTUserPayload:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         id:
 *           type: integer
 *         jwtVersion:
 *           type: integer
 *         role:
 *           type: string
 *         type:
 *           type: string
 *           enum: [access, refresh]
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         status:
 *           type: integer
 *         success:
 *           type: boolean
 *
 */

export const RegisterUserRequestSchema = z.object({
  dob: z.string().date().nonempty(),
  email: z.string().email().nonempty(),
  firstName: z.string().nonempty(),
  lastName: z.string().nonempty(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
  phone: z
    .string()
    .nonempty()
    .regex(/^\+[1-9]\d{1,14}$/, "Invalid international phone number format"),
  type: z.enum(USER_TYPE).default(USER_TYPE[0]),
});

export const JWTRefreshRequestSchema = z.object({
  refreshToken: z.string().jwt(),
});

export const JWTUserPayloadSchema = z.object({
  email: z.string().email(),
  id: z.number(),
  jwtVersion: z.number(),
  role: z.string(),
  type: z.enum(JWT_TYPE),
});

export const LoginUserRequestSchema = z.object({
  email: z.string().email().nonempty(),
  password: z.string().nonempty(),
});

export const LoginUserResponseSchema = z.object({
  accessToken: z.string().jwt().nonempty(),
  refreshToken: z.string().jwt().nonempty(),
  role: z.enum(USER_TYPE).default(USER_TYPE[0]),
});

/**
 * @openapi
 * components:
 *   schemas:
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *         - newPassword
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         newPassword:
 *           type: string
 *           minLength: 8
 *           description: Strong password (min 8 chars, upper/lowercase, digit, special char)
 */
export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

export type ResetPasswordRequestType = z.infer<
  typeof ResetPasswordRequestSchema
>;

export const MeResponseSchema = z.discriminatedUnion("type", [AdminSchema]);

export type JWTRefreshType = z.infer<typeof JWTRefreshRequestSchema>;
export type JWTUserPayloadType = z.infer<typeof JWTUserPayloadSchema>;
export type LoginUserRequestType = z.infer<typeof LoginUserRequestSchema>;
export type LoginUserResponseType = z.infer<typeof LoginUserResponseSchema>;
export type MeResponseType = z.infer<typeof MeResponseSchema>;
export type RegisterUserRequestType = z.infer<typeof RegisterUserRequestSchema>;
