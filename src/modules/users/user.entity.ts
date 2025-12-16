import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

const tinyintBool = {
  to: (v: boolean | null | undefined) => (v == null ? null : v ? 1 : 0),
  from: (v: any) => (v == null ? null : v === 1 || v === '1' || v === true),
};

@Entity('user')
@Index('dni_UNIQUE', ['dni'], { unique: true })
@Index('mail_UNIQUE', ['mail'], { unique: true })
export class User {
  @PrimaryGeneratedColumn({ name: 'id', type: 'int' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 45, default: '' })
  name: string;

  @Column({ name: 'last_name_1', type: 'varchar', length: 45, nullable: true })
  last_name_1: string | null;

  @Column({ name: 'last_name_2', type: 'varchar', length: 45, nullable: true })
  last_name_2: string | null;

  @Column({ name: 'dni', type: 'varchar', length: 20 })
  dni: string;

  @Column({ name: 'mail', type: 'varchar', length: 100 })
  mail: string;

  @Column({ name: 'sex', type: 'varchar', length: 45, nullable: true })
  sex: string | null;

  @Column({ name: 'birthday', type: 'date', nullable: true })
  birthday: string | null; 

  @Column({ name: 'phone', type: 'varchar', length: 45, nullable: true })
  phone: string | null;

  @Column({
    name: 'password',
    type: 'varchar',
    length: 100,
    nullable: true, 
    comment: 'legacy sha256 or bcrypt',
  })
  password: string | null;

  @Column({
    name: 'isValidate',
    type: 'tinyint',
    width: 1,
    nullable: true,                 
    default: () => '1',
    comment: '0 = no validado, 1 = validado',
    transformer: tinyintBool,      
  })
  isValidate: boolean | null;

  @Column({
    name: 'date_insert',
    type: 'timestamp',
    nullable: true,                 
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  date_insert: Date | null;
}
