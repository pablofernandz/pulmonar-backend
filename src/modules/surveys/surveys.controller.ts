import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  Query,
  BadRequestException, 
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SurveysService } from './surveys.service';

import { UpdateSurveyDto } from './dtos/update-survey.dto';
import { UpdateSectionDto } from './dtos/update-section.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';

import { CreateSectionDto } from './dtos/create-section.dto';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { AddResponseDto } from './dtos/add-response.dto';
import { CreateListDto } from './dtos/create-list.dto';
import { AddQuestionToListDto } from './dtos/add-question-to-list.dto';

import { SearchSectionsDto } from './dtos/search-section.dto';
import { AttachSectionsDto } from './dtos/attach-section.dto';

import { SearchQuestionsDto } from './dtos/search-questions.dto';
import { AttachQuestionsDto } from './dtos/attach-questions.dto';

import { SearchResponsesDto } from './dtos/search-responses.dto';
import { AttachResponsesDto } from './dtos/attach-responses.dto';

import { DuplicateSurveyDto } from './dtos/duplicate-survey.dto';
import { CreateSurveyDto } from './dtos/create-survey.dto';

import { CreateResponseDto } from './dtos/create-response.dto';

@ApiTags('surveys')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('surveys')
export class SurveysController {
  constructor(private readonly service: SurveysService) {}


  @Roles('coordinator', 'revisor')
  @Get('search')
  @ApiOperation({ summary: 'Buscar encuestas por id, name, type o q, con paginación y ordenación' })
  @ApiQuery({ name: 'id', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String, description: '0 = Historia, 1 = Revisión' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'búsqueda libre por nombre; numérico intenta por id' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'orderBy', required: false, type: String, example: 'date_insert', description: 'date_insert | name | id | type' })
  @ApiQuery({ name: 'orderDir', required: false, type: String, example: 'DESC', description: 'ASC | DESC' })
  search(@Query() query: any) {
    return this.service.searchSurveys(query);
  }

  @Roles('coordinator', 'revisor')
  @Get()
  @ApiOperation({ summary: 'Listar encuestas (si hay filtros, busca)' })
  listOrSearch(@Query() query: any) {
    const hasSearchParams =
      query?.id !== undefined ||
      query?.name !== undefined ||
      query?.type !== undefined ||
      query?.q !== undefined ||
      query?.page !== undefined ||
      query?.limit !== undefined ||
      query?.orderBy !== undefined ||
      query?.orderDir !== undefined;

    if (hasSearchParams) return this.service.searchSurveys(query);
    return this.service.listSurveys();
  }

  @Roles('coordinator', 'revisor')
  @Get(':id')
  @ApiOperation({ summary: 'Árbol de encuesta (secciones y preguntas ordenadas)' })
  getSurveyTree(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSurveyTree(id);
  }


  @Roles('coordinator')
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de la encuesta' })
  updateSurvey(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSurveyDto,
  ) {
    return this.service.updateSurvey(id, dto);
  }

  @Roles('coordinator')
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar encuesta (soft-delete)' })
  deleteSurvey(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteSurvey(id);
  }

  @Roles('coordinator')
  @Patch('section/:id')
  @ApiOperation({
    summary: 'Actualizar sección (renombrar y/o mover)',
    description:
      'Si la sección está enlazada en >1 formulario y vas a modificarla, se aplica Copy-On-Write.',
  })
  updateSection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.service.updateSection(id, dto);
  }

  @Roles('coordinator')
  @Delete('section/:id')
  @ApiOperation({ summary: 'Eliminar sección (soft-delete)' })
  deleteSection(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteSection(id);
  }

  @Roles('coordinator')
  @Patch('question/:id')
  @ApiOperation({
    summary: 'Actualizar pregunta (renombrar y/o mover dentro de su sección)',
    description:
      'Si la pregunta está enlazada en >1 sección y vas a modificarla desde esta sección, se aplica COW a nivel de pregunta.',
  })
  updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.service.updateQuestion(id, dto);
  }

  @Roles('coordinator')
  @Delete('question/:id')
  @ApiOperation({ summary: 'Eliminar pregunta (soft-delete)' })
  deleteQuestion(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteQuestion(id);
  }


  @Roles('coordinator')
  @Post(':id/sections')
  @ApiOperation({
    summary: 'Crear sección NUEVA y vincularla a la encuesta',
  })
  createSectionAndAttach(
    @Param('id', ParseIntPipe) idSurvey: number,
    @Body() dto: CreateSectionDto,
    @Req() req: any,
  ) {
    return this.service.createSectionAndAttach(idSurvey, dto, req.user);
  }

  @Roles('coordinator')
  @Post('section/:id/questions')
  @ApiOperation({
    summary: 'Crear pregunta NUEVA y vincularla a la sección',
  })
  createQuestionAndAttach(
    @Param('id', ParseIntPipe) idSection: number,
    @Body() dto: CreateQuestionDto,
    @Req() req: any,
  ) {
    return this.service.createQuestionAndAttach(idSection, dto, req.user);
  }

  @Roles('coordinator')
  @Post('question/:id/responses')
  @ApiOperation({
    summary: 'Vincular respuesta EXISTENTE a la pregunta (unitario, con orden)',
  })
  addResponseToQuestion(
    @Param('id', ParseIntPipe) idQuestion: number,
    @Body() dto: AddResponseDto,
  ) {
    return this.service.addResponseToQuestion(idQuestion, dto);
  }

  @Roles('coordinator')
  @Post('questions/:id/list')
  @ApiOperation({ summary: 'Crear lista y asociarla a la pregunta propietaria' })
  createListForQuestion(
    @Param('id', ParseIntPipe) idQuestionOwner: number,
    @Body() dto: CreateListDto,
    @Req() req: any,
  ) {
    return this.service.createListForQuestion(idQuestionOwner, dto, req.user);
  }

  @Roles('coordinator')
  @Post('items/:listId/questions')
  @ApiOperation({
    summary: 'Añadir pregunta EXISTENTE a una lista',
  })
  addQuestionToList(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: AddQuestionToListDto,
  ) {
    return this.service.addQuestionToList(listId, dto);
  }


  @Roles('coordinator')
  @Post()
  @ApiOperation({ summary: 'Crear encuesta vacía (draft)' })
  createSurvey(@Body() dto: CreateSurveyDto) {
    return this.service.createSurvey(dto);
  }

  @Roles('coordinator')
  @Post(':targetId/duplicate-into/:sourceId')
  @ApiOperation({
    summary: 'Cargar el contenido de otra encuesta en un borrador (reutilizando secciones)',
  })
  duplicateInto(
    @Param('targetId', ParseIntPipe) targetId: number,
    @Param('sourceId', ParseIntPipe) sourceId: number,
  ) {
    return this.service.replaceSurveyContentWithDuplicate(targetId, sourceId);
  }


  @Roles('coordinator')
  @Post(':id/duplicate')
  @ApiOperation({
    summary: 'Duplicar encuesta reutilizando secciones (shallow)',
  })
  duplicateSurvey(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DuplicateSurveyDto,
  ) {
    return this.service.duplicateSurvey(id, dto);
  }

  @Roles('coordinator')
  @Post(':id/finalize')
  @ApiOperation({ summary: 'Validar encuesta (≥ 1 sección) y devolver OK' })
  finalize(@Param('id', ParseIntPipe) id: number) {
    return this.service.finalizeSurvey(id);
  }


  @Roles('coordinator', 'revisor')
  @Get('sections/search')
  @ApiOperation({ summary: 'Buscar secciones existentes (paginación y orden)' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'idCoordinator', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'orderBy', required: false, type: String, example: 'date_insert', description: 'name | date_insert | id' })
  @ApiQuery({ name: 'orderDir', required: false, type: String, example: 'DESC', description: 'ASC | DESC' })
  searchSections(@Query() query: SearchSectionsDto) {
    return this.service.searchSections(query);
  }

  @Roles('coordinator', 'revisor')
  @Get('sections/:id/preview')
  @ApiOperation({ summary: 'Preview reducida de una sección (nombre + nº preguntas)' })
  getSectionPreview(@Param('id', ParseIntPipe) idSection: number) {
    return this.service.getSectionPreview(idSection);
  }

  @Roles('coordinator', 'revisor')
  @Get('sections/:id/tree')
  @ApiOperation({ summary: 'Árbol de una sección (preguntas con sus respuestas)' })
  getSectionTree(@Param('id', ParseIntPipe) idSection: number) {
    return this.service.getSectionTree(idSection);
  }

  @Roles('coordinator', 'revisor')
  @Get('sections/tree')
  @ApiOperation({ summary: 'Árbol de varias secciones por ids (batch)' })
  @ApiQuery({ name: 'ids', required: true, type: String, example: '10,11,12' })
  getSectionsTree(@Query('ids') ids?: string) {
    if (!ids || !ids.trim()) return [];
    const list = ids
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!list.length) throw new BadRequestException('ids inválidos');
    return this.service.getSectionsTree(list);
  }

  @Roles('coordinator')
  @Post(':id/sections/attach')
  @ApiOperation({
    summary: 'Adjuntar secciones EXISTENTES a la encuesta (reutilización, sin clonar)',
  })
  attachExistingSections(
    @Param('id', ParseIntPipe) idSurvey: number,
    @Body() dto: AttachSectionsDto,
  ) {
    return this.service.attachExistingSections(idSurvey, dto);
  }


  @Roles('coordinator', 'revisor')
  @Get('questions/search')
  @ApiOperation({ summary: 'Buscar preguntas existentes (paginación y orden)' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'idCoordinator', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'orderBy', required: false, type: String, example: 'date_insert', description: 'name | date_insert | id' })
  @ApiQuery({ name: 'orderDir', required: false, type: String, example: 'DESC', description: 'ASC | DESC' })
  searchQuestions(@Query() query: SearchQuestionsDto) {
    return this.service.searchQuestions(query);
  }

  @Roles('coordinator', 'revisor')
  @Get('questions/:id/preview')
  @ApiOperation({ summary: 'Preview reducida de una pregunta (nombre + nº respuestas activas)' })
  getQuestionPreview(@Param('id', ParseIntPipe) idQuestion: number) {
    return this.service.getQuestionPreview(idQuestion);
  }

  @Roles('coordinator')
  @Post('section/:id/questions/attach')
  @ApiOperation({
    summary: 'Adjuntar preguntas EXISTENTES a una sección (reutilización, sin clonar)',
  })
  attachExistingQuestions(
    @Param('id', ParseIntPipe) idSection: number,
    @Body() dto: AttachQuestionsDto,
  ) {
    return this.service.attachExistingQuestions(idSection, dto);
  }


@Roles('coordinator')
@Post(':surveyId/section/:sectionId/questions/attach')
@ApiOperation({ summary: 'Adjunta preguntas a una sección del survey (COW si compartida)' })
attachQuestionsCow(
  @Param('surveyId', ParseIntPipe) surveyId: number,
  @Param('sectionId', ParseIntPipe) sectionId: number,
  @Body() dto: AttachQuestionsDto,
  @Req() req: any,
) {
  return this.service.attachQuestionsCow(surveyId, sectionId, dto);
}

@Roles('coordinator')
@Post(':surveyId/section/:sectionId/questions')
@ApiOperation({ summary: 'Crea pregunta y la adjunta a la sección del survey (COW si compartida)' })
createQuestionCow(
  @Param('surveyId', ParseIntPipe) surveyId: number,
  @Param('sectionId', ParseIntPipe) sectionId: number,
  @Body() dto: CreateQuestionDto, 
  @Req() req: any,
) {
  return this.service.createQuestionCow(surveyId, sectionId, dto);
}

@Roles('coordinator')
@Delete(':surveyId/section/:sectionId/questions/:questionId')
@ApiOperation({ summary: 'Desenlaza una pregunta de la sección del survey (COW si compartida)' })
detachQuestionCow(
  @Param('surveyId', ParseIntPipe) surveyId: number,
  @Param('sectionId', ParseIntPipe) sectionId: number,
  @Param('questionId', ParseIntPipe) questionId: number,
  @Req() req: any,
) {
  return this.service.detachQuestionCow(surveyId, sectionId, questionId);
}

@Roles('coordinator')
@Delete(':surveyId/sections/:sectionId')
@ApiOperation({ summary: 'Desenlaza una sección del survey (no borra la sección global)' })
detachSection(
  @Param('surveyId', ParseIntPipe) surveyId: number,
  @Param('sectionId', ParseIntPipe) sectionId: number,
  @Req() req: any,
) {
  return this.service.detachSection(surveyId, sectionId);
}



  @Roles('coordinator', 'revisor')
  @Get('responses/search')
  @ApiOperation({ summary: 'Buscar respuestas existentes (paginación y orden)' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'tinyint(1) libre según tu modelo' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'orderBy', required: false, type: String, example: 'date_insert', description: 'name | date_insert | id' })
  @ApiQuery({ name: 'orderDir', required: false, type: String, example: 'DESC', description: 'ASC | DESC' })
  searchResponses(@Query() query: SearchResponsesDto) {
    return this.service.searchResponses(query);
  }

  @Roles('coordinator', 'revisor')
  @Get('responses/:id/preview')
  @ApiOperation({ summary: 'Preview reducida de una respuesta (nombre + nº de preguntas que la usan)' })
  getResponsePreview(@Param('id', ParseIntPipe) idResponse: number) {
    return this.service.getResponsePreview(idResponse);
  }

  @Roles('coordinator')
  @Post('question/:id/responses/attach')
  @ApiOperation({
    summary: 'Adjuntar respuestas EXISTENTES a una pregunta (reutilización, sin clonar)',
  })
  attachExistingResponses(
    @Param('id', ParseIntPipe) idQuestion: number,
    @Body() dto: AttachResponsesDto,
  ) {
    return this.service.attachExistingResponses(idQuestion, dto);
  }

  @Roles('coordinator')
  @Post('question/:id/responses/new')
  @ApiOperation({
    summary: 'Crear respuesta NUEVA y vincularla a la pregunta',
    description: 'Crea una fila `response` y la enlaza en `questionresponse` con el orden indicado.',
  })
  createResponseAndAttach(
    @Param('id', ParseIntPipe) idQuestion: number,
    @Body() dto: CreateResponseDto,
    @Req() req: any,
  ) {
    return this.service.createResponseAndAttach(idQuestion, dto, req.user);
  }
}
