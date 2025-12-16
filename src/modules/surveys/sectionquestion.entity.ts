import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Section } from './section.entity';
import { Question } from './question.entity';

@Entity({ name: 'sectionquestion' })
@Index('fk_SectionQuestion_Question1', ['idQuestion'])
@Index('fk_SectionQuestion_Section1_idx', ['idSection'])
export class SectionQuestion {
  
  @PrimaryColumn({ name: 'idSection', type: 'int' })
  idSection: number;

  @PrimaryColumn({ name: 'idQuestion', type: 'int' })
  idQuestion: number;

  @Column({ name: 'order', type: 'tinyint', width: 2 })
  order: number;

  @Column({
    name: 'date_update',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  date_update: Date;

  @ManyToOne(() => Section, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idSection', referencedColumnName: 'id' })
  section: Section;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idQuestion', referencedColumnName: 'id' })
  question: Question;
}
