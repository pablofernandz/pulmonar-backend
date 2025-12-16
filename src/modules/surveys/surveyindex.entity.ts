import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IndexDef } from './index.entity';
import { Survey } from './survey.entity';

@Entity({ name: 'surveyindex' })
export class SurveyIndex {
  
  @PrimaryColumn({ name: 'idIndex', type: 'int' })
  idIndex: number;

  @PrimaryColumn({ name: 'idSurvey', type: 'int' })
  idSurvey: number;

  @ManyToOne(() => IndexDef, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idIndex', referencedColumnName: 'id' })
  index: IndexDef;

  @ManyToOne(() => Survey, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idSurvey', referencedColumnName: 'id' })
  survey: Survey;

  @Column({ name: 'deleted', type: 'tinyint', width: 1, nullable: true, default: () => '0' })
  deleted: number | null;

  @Column({ name: 'date_insert', type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  date_insert: Date | null;
}
