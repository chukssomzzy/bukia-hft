import AppDataSource from "../data-source";
import { Admin } from "../models/admin";

export const AdminRepository = AppDataSource.getRepository(Admin);
