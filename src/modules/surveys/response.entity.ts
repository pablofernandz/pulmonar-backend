import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'response' })
export class ResponseEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'type', type: 'tinyint', width: 1, default: () => '0' })
  type: number;

  @Column({ name: 'unity', type: 'varchar', length: 45, nullable: true })
  unity: string | null;

  @Column({ name: 'min', type: 'varchar', length: 45, nullable: true })
  min: string | null;

  @Column({ name: 'max', type: 'varchar', length: 45, nullable: true })
  max: string | null;

  @Column({ name: 'deleted', type: 'tinyint', width: 1, default: () => '0' })
  deleted: number;

  @Column({ name: 'date_insert', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date_insert: Date;

  @Column({
    name: 'date_update',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  date_update: Date;

  @Column({ name: 'idCoordinator', type: 'int', nullable: true })
  idCoordinator: number | null;
}
