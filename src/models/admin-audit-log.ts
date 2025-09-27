import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "admin_audit_log" })
export class AdminAuditLog {
  @Column()
  action: string;

  @Column()
  adminUserId: number;

  @Column("jsonb", { nullable: true })
  details?: Record<string, unknown>;

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  targetUserId?: number;

  @Column()
  timestamp: string;
}
