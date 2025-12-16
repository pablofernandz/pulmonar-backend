import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

import { Survey } from './survey.entity';
import { Section } from './section.entity';
import { Question } from './question.entity';
import { ResponseEntity } from './response.entity';
import { QuestionList } from './questionlist.entity';
import { SurveySection } from './surveysection.entity';
import { SectionQuestion } from './sectionquestion.entity';
import { QuestionResponse } from './questionresponse.entity';
import { IndexDef } from './index.entity';
import { SurveyIndex } from './surveyindex.entity';
import { IndexQuestion } from './index-question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Survey,
      Section,
      Question,
      ResponseEntity,
      QuestionList,
      SurveySection,
      SectionQuestion,
      QuestionResponse,
      IndexDef,
      SurveyIndex,
      IndexQuestion,
    ]),
  ],
  controllers: [SurveysController, CatalogController],
  providers: [SurveysService, CatalogService],
  exports: [TypeOrmModule, SurveysService, CatalogService],
})
export class SurveysModule {}
