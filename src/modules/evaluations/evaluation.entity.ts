import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Survey } from '../surveys/survey.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Revisor } from '../revisores/revisor.entity';

@Entity({ name: 'evaluation' })
export class Evaluation {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @ManyToOne(() => Survey, { eager: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idSurvey', referencedColumnName: 'id' })
  survey: Survey;

  @ManyToOne(() => Paciente, { eager: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idPatient', referencedColumnName: 'id' })
  patient: Paciente;

  @ManyToOne(() => Revisor, { eager: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idRevisor', referencedColumnName: 'id' })
  revisor: Revisor;

  @Column({ name: 'date', type: 'datetime' })
  date: Date;

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
}
