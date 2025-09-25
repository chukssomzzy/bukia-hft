import { ChildEntity } from "typeorm";

import { UserRole } from "../enums/user-roles";
import { User } from "./user";

@ChildEntity(UserRole.SUPER_ADMIN)
export class SuperAdmin extends User {}
