import bcrypt from "bcrypt";
import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  Unique,
  UpdateDateColumn,
} from "typeorm";

import ExtendedBaseEntity from "./extended-base-entity";
import { UserProfile } from "./user-profile";

@Entity()
@TableInheritance({
  column: {
    name: "type",
    type: "varchar",
  },
})
@Unique(["email"])
export class User extends ExtendedBaseEntity {
  @Column({ nullable: false })
  country: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @Column()
  email: string;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    default: false,
  })
  isverified: boolean;

  @Column({ default: 0, nullable: false })
  jwtVersion: number;

  @Column({ nullable: true })
  password: string;

  @JoinColumn()
  @OneToOne(() => UserProfile, { cascade: true })
  profile?: UserProfile;

  @Column()
  type: string;

  @UpdateDateColumn()
  updatedAt: Date;

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return await bcrypt.compare(password, this.password);
  }
}
