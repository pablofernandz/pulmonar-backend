import {
  Entity,
  Column,
  PrimaryColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Evaluation } from './evaluation.entity';

@Entity({ name: 'evaluation_question' })
@Index(
  'unique_evaluation',
  ['idEvaluation', 'idSection', 'idQuestion', 'idQuestionList', 'idResponse'],
  { unique: true },
)
export class EvaluationAnswer {
  @PrimaryColumn({ name: 'idEvaluation', type: 'int' })
  idEvaluation: number;

  @PrimaryColumn({ name: 'idSection', type: 'int' })
  idSection: number;

  @PrimaryColumn({ name: 'idQuestion', type: 'int' })
  idQuestion: number;

  @Column({ name: 'idQuestionList', type: 'int', nullable: true })
  idQuestionList: number | null;

  @PrimaryColumn({ name: 'idResponse', type: 'int' })
  idResponse: number;

  @Column({ name: 'value', type: 'text', nullable: true })
  value: string | null;

  @Column({ name: 'deleted', type: 'int', default: () => '0' })
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

  @ManyToOne(() => Evaluation, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idEvaluation', referencedColumnName: 'id' })
  evaluation: Evaluation;
}
