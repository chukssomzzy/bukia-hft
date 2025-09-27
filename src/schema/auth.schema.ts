import { z } from "zod";

import { AdminSchema } from "./admin.schema";
import { SuperAdminSchema } from "./superadmin.schema";
import { RegularUserSchema, UserSchema } from "./user.schema";
export const USER_TYPE = ["User", "Admin", "Superadmin"] as const;
export const JWT_TYPE = ["access", "refresh"] as const;
export const OTP_PURPOSE = [
  "emailVerification",
  "passwordReset",
  "authorize",
] as const;

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
 *         country:
 *           type: string
 *           example: NG
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
  country: z
    .string()
    .length(2, "Country code must be two letters")
    .transform((val) => val.toUpperCase()),
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

/**
 * @openapi
 * components:
 *   schemas:
 *     GetOtpRequest:
 *       type: object
 *       required:
 *         - email
 *         - purpose
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         purpose:
 *           type: string
 *           enum: [emailVerification, passwordReset, authorize]
 */
export const GetOtpSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSE).default(OTP_PURPOSE[0]),
});

/**
 * @openapi
 * components:
 *   schemas:
 *     ValidateOtp:
 *       type: object
 *       required:
 *         - email
 *         - otp
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         otp:
 *           type: string
 *           minLength: 6
 *           maxLength: 6
 *           pattern: '^\d{6}$'
 */
export const ValidateOtpSchema = z.object({
  email: z.string().email(),
  otp: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must be numeric"),
  purpose: z.enum(OTP_PURPOSE).default(OTP_PURPOSE[0]),
});

export type ResetPasswordRequestType = z.infer<
  typeof ResetPasswordRequestSchema
>;

export const MeResponseSchema = z.discriminatedUnion("type", [
  AdminSchema,
  RegularUserSchema,
  SuperAdminSchema,
]);

export type GetOtpType = z.infer<typeof GetOtpSchema>;
export type JWTRefreshType = z.infer<typeof JWTRefreshRequestSchema>;
export type JWTUserPayloadType = z.infer<typeof JWTUserPayloadSchema>;
export type LoginUserRequestType = z.infer<typeof LoginUserRequestSchema>;
export type LoginUserResponseType = z.infer<typeof LoginUserResponseSchema>;
export type MeResponseType = z.infer<typeof MeResponseSchema>;
export type RegisterUserRequestType = z.infer<typeof RegisterUserRequestSchema>;
export type ValidateOtpType = z.infer<typeof ValidateOtpSchema>;
