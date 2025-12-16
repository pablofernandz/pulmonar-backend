import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'section' })
@Index('fk_Section_Coordinator1_idx', ['idCoordinator'])
export class Section {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 200, default: '' })
  name: string;

  @Column({ name: 'idCoordinator', type: 'int' })
  idCoordinator: number;

  @Column({ name: 'question_optional', type: 'varchar', length: 500, nullable: true })
  question_optional: string | null;

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
