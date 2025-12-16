import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Group } from './group.entity';
import { Revisor } from '../revisores/revisor.entity';

@Entity({ name: 'grouprevisor' })
@Index('fk_GroupRevisor_Revisor1_idx', ['idRevisor'])
export class GroupRevisor {
  
  @PrimaryColumn({ type: 'int', name: 'idGroup' })
  idGroup: number;

  @PrimaryColumn({ type: 'int', name: 'idRevisor' })
  idRevisor: number;

  @ManyToOne(() => Group, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idGroup', referencedColumnName: 'id' })
  group: Group;

  @ManyToOne(() => Revisor, { onDelete: 'RESTRICT', onUpdate: 'NO ACTION' })
  @JoinColumn({ name: 'idRevisor', referencedColumnName: 'id' })
  revisor: Revisor;

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
