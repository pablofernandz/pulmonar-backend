import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Evaluation } from './evaluation.entity';
import { EvaluationAnswer } from './evaluation-answer.entity';
import { EvaluationIndex } from './evaluation-index.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Survey } from '../surveys/survey.entity';
import { Question } from '../surveys/question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evaluation,
      EvaluationAnswer,
      EvaluationIndex,
      Paciente,
      Survey,
      Question,
    ]),
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService, TypeOrmModule],
})
export class EvaluationsModule {}


