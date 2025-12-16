import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity({ name: 'question' })
@Index('question_questionList_uindex', ['questionList'], { unique: true })
export class Question {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 400, default: '' })
  name: string;

  @Column({ name: 'questionList', type: 'int', nullable: true })
  questionList: number | null; 

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

  @Column({ name: 'idCoordinator', type: 'int', nullable: true, default: () => '2' })
  idCoordinator: number | null; 
}
