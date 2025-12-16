import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Question } from './question.entity';
import { ResponseEntity } from './response.entity';

@Entity({ name: 'questionresponse' })
export class QuestionResponse {
  
  @PrimaryColumn({ name: 'idQuestion', type: 'int' })
  idQuestion: number;

  @PrimaryColumn({ name: 'idResponse', type: 'int' })
  idResponse: number;

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

  @Column({ name: 'order', type: 'tinyint', width: 2 })
  order: number;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idQuestion', referencedColumnName: 'id' })
  question: Question;

  @ManyToOne(() => ResponseEntity, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idResponse', referencedColumnName: 'id' })
  response: ResponseEntity;
}
