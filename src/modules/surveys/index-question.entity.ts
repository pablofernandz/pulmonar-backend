import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IndexDef } from './index.entity';
import { Question } from './question.entity';

@Entity({ name: 'index_question' })
export class IndexQuestion {

  @PrimaryColumn({ name: 'idQuestion', type: 'int' })
  idQuestion: number;

  @PrimaryColumn({ name: 'idIndex', type: 'int' })
  idIndex: number;

  @ManyToOne(() => IndexDef, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idIndex', referencedColumnName: 'id' })
  index: IndexDef;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idQuestion', referencedColumnName: 'id' })
  question: Question;

  @Column({ name: 'deleted', type: 'tinyint', width: 1, nullable: true, default: () => '0' })
  deleted: number | null;

  @Column({ name: 'date_insert', type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  date_insert: Date | null;
}
