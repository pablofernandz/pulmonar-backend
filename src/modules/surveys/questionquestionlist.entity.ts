import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Question } from './question.entity';
import { QuestionList } from './questionlist.entity';

@Entity({ name: 'questionquestionlist' })
export class QuestionQuestionList {
  
  @PrimaryColumn({ name: 'idQuestionList', type: 'int' })
  idQuestionList: number;

  @PrimaryColumn({ name: 'idQuestion', type: 'int' })
  idQuestion: number;

  @Column({ name: 'order', type: 'tinyint', width: 2, nullable: true })
  order: number | null;

  @ManyToOne(() => QuestionList, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idQuestionList', referencedColumnName: 'id' })
  list: QuestionList;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idQuestion', referencedColumnName: 'id' })
  question: Question;
}
