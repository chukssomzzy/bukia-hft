import {
  BaseEntity,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

class ExtendedBaseEntity<T = number> extends BaseEntity {
  @CreateDateColumn()
  createdAt: Date;

  @PrimaryGeneratedColumn()
  public id: T;

  @UpdateDateColumn()
  updatedAt: Date;
}

export default ExtendedBaseEntity;
