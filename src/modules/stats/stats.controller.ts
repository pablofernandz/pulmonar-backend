import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StatsService } from './stats.service';
import { RangeDto } from './dtos/range.dto';
import { EvalsQueryDto } from './dtos/evals-query.dto';

import { StatsGlobalQueryDto } from './dtos/stats-global.dto';
import { StatsGlobalResponse } from './types/stats-global.types';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Roles('coordinator')
  @Get('global')
  @ApiOperation({ summary: 'Estadísticas globales: tabla plana de índices + parámetros' })
  @ApiQuery({ name: 'from', required: false, description: 'Fecha inicio (DATETIME BD, inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'Fecha fin (DATETIME BD, inclusive)' })
  @ApiQuery({ name: 'groupId', required: false, type: Number, description: 'Filtra por grupo (histórico en la fecha de la evaluación)' })
  @ApiQuery({ name: 'indexId', required: false, type: Number, description: 'ID de índice (prioritario frente a indexName)' })
  @ApiQuery({ name: 'indexName', required: false, type: String, description: 'Nombre del índice (p.ej. CAT, GOLD...)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5000 })
  getGlobal(@Query() q: StatsGlobalQueryDto): Promise<StatsGlobalResponse> {
    return this.stats.getGlobal(q);
  }

  @Roles('coordinator', 'revisor')
  @Get('surveys/:surveyId/summary')
  @ApiOperation({ summary: 'Resumen de un survey (totales, completadas, índices, por revisor)' })
  surveySummary(@Param('surveyId', ParseIntPipe) surveyId: number, @Query() q: RangeDto) {
    return this.stats.surveySummary(surveyId, q);
  }

  @Roles('coordinator', 'revisor')
  @Get('groups/:groupId/summary')
  @ApiOperation({ summary: 'Resumen de un grupo (activos, evaluaciones, por survey y por revisor)' })
  groupSummary(@Param('groupId', ParseIntPipe) groupId: number, @Query() q: RangeDto) {
    return this.stats.groupSummary(groupId, q);
  }

  @Roles('coordinator', 'revisor')
  @Get('evaluations')
  @ApiOperation({ summary: 'Listado de evaluaciones con filtros y paginación' })
  listEvaluations(@Query() q: EvalsQueryDto) {
    return this.stats.listEvaluations(q);
  }
}
