import { z } from "zod";

import { UserProfileSchema } from "./user-profile.schema";
import { USER_TYPE, UserSchema } from "./user.schema";

export const AdminSchema = UserSchema.extend({
  profile: UserProfileSchema,
  type: z.literal(USER_TYPE[1]),
});

export type AdminType = z.infer<typeof AdminSchema>;
