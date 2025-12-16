import {
  Entity, PrimaryColumn, Column, OneToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('revisor')
@Index('fk_Revisor_User1_idx', ['id'])
export class Revisor {
  @PrimaryColumn({ name: 'id', type: 'int' })
  id: number;

  @OneToOne(() => User, {
    eager: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn({ name: 'id', referencedColumnName: 'id' })
  user: User;

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
