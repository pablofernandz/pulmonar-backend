import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Survey } from './survey.entity';
import { Section } from './section.entity';

@Entity({ name: 'surveysection' })
@Index('fk_SurveySection_Survey1_idx', ['idSurvey'])
export class SurveySection {
  @PrimaryColumn({ name: 'idSection', type: 'int' })
  idSection: number;

  @PrimaryColumn({ name: 'idSurvey', type: 'int' })
  idSurvey: number;

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

  @ManyToOne(() => Survey, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idSurvey', referencedColumnName: 'id' })
  survey: Survey;
}
