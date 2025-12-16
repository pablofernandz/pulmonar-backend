import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Paciente } from '../pacientes/paciente.entity';
import { Revisor } from '../revisores/revisor.entity';
import { StatusAppointment } from './statusappointment.entity';

@Entity({ name: 'appointment' })
@Index('appointment___fk_type', ['type'])
@Index('idx_appt_date', ['date'])
@Index('idx_appt_status', ['status'])
@Index('idx_appt_revisor_date', ['revisor', 'date'])
@Index('idx_appt_patient_date', ['patient', 'date'])
export class Appointment {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ name: 'date', type: 'datetime' })
  date: Date;

  @ManyToOne(() => StatusAppointment, { eager: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'status', referencedColumnName: 'id' })
  status: StatusAppointment;

  @Column({ name: 'comments', type: 'varchar', length: 400, nullable: true })
  comments: string | null;

  @Column({ name: 'type', type: 'tinyint', unsigned: true })
  type: number;

  @ManyToOne(() => Paciente, { eager: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'patient', referencedColumnName: 'id' })
  patient: Paciente;

  @ManyToOne(() => Revisor, { eager: true, onDelete: 'RESTRICT', onUpdate: 'NO ACTION', nullable: false })
  @JoinColumn({ name: 'revisor', referencedColumnName: 'id' })
  revisor: Revisor;

  @Column({
    name: 'date_update',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  date_update: Date;
}
