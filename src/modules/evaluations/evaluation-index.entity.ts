import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Evaluation } from './evaluation.entity';

@Entity({ name: 'evaluation_index' })
export class EvaluationIndex {
  @PrimaryColumn({ name: 'idEvaluation', type: 'int' })
  idEvaluation: number;

  @PrimaryColumn({ name: 'idIndex', type: 'int' })
  idIndex: number;

  @Column({ name: 'value', type: 'float' })
  value: number;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'date_insert', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  date_insert: Date;

  @ManyToOne(() => Evaluation, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idEvaluation', referencedColumnName: 'id' })
  evaluation: Evaluation;
}
