import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'index' }) 
export class IndexDef {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ name: 'text', type: 'text', nullable: true })
  text: string | null;

  @Column({ name: 'deleted', type: 'tinyint', width: 1, nullable: true, default: () => '0' })
  deleted: number | null;

  @Column({ name: 'date_insert', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', nullable: true })
  date_insert: Date | null;
}
