import { z } from "zod";

import { USER_TYPE, UserSchema } from "./user.schema";

export const SuperAdminSchema = UserSchema.extend({
  type: z.literal(USER_TYPE[2]),
});

export type SuperAdminType = z.infer<typeof SuperAdminSchema>;
