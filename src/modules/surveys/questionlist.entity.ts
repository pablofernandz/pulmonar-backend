import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'questionlist' })
export class QuestionList {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({
    name: 'listname',
    type: 'varchar',
    length: 200,
    nullable: true,
    default: () => "'Lista de elementos'",
  })
  listname: string | null;

  @Column({
    name: 'date_insert',
    type: 'timestamp',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  date_insert: Date | null;
}
