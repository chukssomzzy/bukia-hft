import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  VersionColumn,
} from "typeorm";

import ExtendedBaseEntity from "./extended-base-entity";

@Entity()
export class UserProfile extends ExtendedBaseEntity<string> {
  @Column({ nullable: true })
  avatarUrl: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;

  @Column()
  firstName: string;

  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  lastName: string;

  @VersionColumn()
  version: number;
}
