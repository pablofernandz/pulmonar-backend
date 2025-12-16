import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'group' })
@Index('group_name_uindex', ['name'], { unique: true })
export class Group {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ type: 'varchar', length: 45, name: 'name' })
  name: string;

  @Column({ type: 'int', name: 'story', nullable: true })
  story: number | null;

  @Column({ type: 'int', name: 'revision', nullable: true })
  revision: number | null;

  @Column({
    name: 'date_update',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  date_update: Date;
}

