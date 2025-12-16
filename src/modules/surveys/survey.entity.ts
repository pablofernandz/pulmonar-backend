import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'survey' })
@Index('fk_Survey_Coordinator1_idx', ['idCoordinator'])
export class Survey {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ name: 'idCoordinator', type: 'int' })
  idCoordinator: number;

  @Column({ name: 'name', type: 'varchar', length: 45, default: '' })
  name: string;

  @Column({ name: 'type', type: 'tinyint', width: 1 })
  type: number;

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
}
