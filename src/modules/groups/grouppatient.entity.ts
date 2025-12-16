import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Group } from './group.entity';
import { Paciente } from '../pacientes/paciente.entity';

@Entity({ name: 'grouppatient' })
@Index('fk_GroupPatient_Patient1_idx', ['idPatient'])
export class GroupPatient {

  @PrimaryColumn({ type: 'int', name: 'idGroup' })
  idGroup: number;

  @PrimaryColumn({ type: 'int', name: 'idPatient' })
  idPatient: number;

  @ManyToOne(() => Group, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idGroup', referencedColumnName: 'id' })
  group: Group;

  @ManyToOne(() => Paciente, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idPatient', referencedColumnName: 'id' })
  patient: Paciente;

  @Column({ type: 'tinyint', width: 1, name: 'deleted', default: () => '0' })
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
