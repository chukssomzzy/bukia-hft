import { ChildEntity } from "typeorm";

import { UserRole } from "../enums/user-roles";
import { User } from "./user";

@ChildEntity(UserRole.ADMIN)
export class Admin extends User {}
