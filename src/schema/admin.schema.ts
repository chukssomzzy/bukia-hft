import { z } from "zod";

import { USER_TYPE, UserSchema } from "./user.schema";

export const AdminSchema = UserSchema.extend({
  type: z.literal(USER_TYPE[1]),
});

export type AdminType = z.infer<typeof AdminSchema>;
