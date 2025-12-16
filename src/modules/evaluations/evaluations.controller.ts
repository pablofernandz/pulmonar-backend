import {
  Controller, Post, Body, UseGuards, Req, Res, Param, ParseIntPipe, Get, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dtos/create-evaluation.dto';
import { SaveAnswersDto } from './dtos/save-answers.dto';
import { ListQueryDto } from '../../common/pagination/list-query.dto';
import { buildMeta, normOrderDir } from '../../common/pagination/pagination.util';

@ApiTags('evaluations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  @Roles('patient', 'revisor')
  @Get('mine')
  async listMine(@Req() req: any, @Query() query: ListQueryDto) {
    const isPatient = !!req.user?.roles?.patient;
    const items = isPatient
      ? await this.service.listByPatient(req.user.id)
      : await this.service.listByRevisor(req.user.id);

    const orderBy = query.orderBy || 'date';
    const orderDir = normOrderDir(query.orderDir, 'DESC');
    const page = query.page ?? 1;
    const limit = query.limit ?? (items.length || 1);
    const totalItems = items.length;

    return {
      items,
      meta: buildMeta({ page, limit, totalItems, orderBy, orderDir, q: query.q }),
    };
  }

 @Roles('patient','revisor')
 @Get(':id/view')
 getView(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
   const roles = req.user?.roles || {};
   if (roles.coordinator || roles.revisor) {
      return this.service.getIfStaffAllowed(id, req.user);
   }
   return this.service.getIfOwned(id, req.user.id);
 }



  @Roles('patient', 'revisor', 'coordinator')
  @Get(':id/export.csv')
  async exportCsv(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Res() res: any) {
    const csv = await this.service.exportCsvForUser(id, req.user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evaluation_${id}.csv"`);
    return res.send(csv);
  }

  @Roles('coordinator','revisor')
  @Post()
  create(@Body() dto: CreateEvaluationDto, @Req() req: any) {
    return this.service.create(dto, req.user);
  }

  @Roles('coordinator','revisor')
  @Post(':id/answers')
  saveAnswers(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveAnswersDto, @Req() req: any) {
    return this.service.saveAnswers(id, dto, req.user);
  }

  @Roles('coordinator','revisor')
  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.submit(id, req.user);
  }

  @Roles('coordinator')
  @Get()
  async searchAll(
    @Query('patient') patient?: string,
    @Query('revisor') revisor?: string,
    @Query('survey') survey?: string,
    @Query() query?: ListQueryDto,
  ) {
    const filters = {
      patientId: patient ? Number(patient) : undefined,
      revisorId: revisor ? Number(revisor) : undefined,
      surveyId: survey ? Number(survey) : undefined,
    };
    const items = await this.service.search(filters);

    const orderBy = query?.orderBy || 'date';
    const orderDir = normOrderDir(query?.orderDir, 'DESC');
    const page = query?.page ?? 1;
    const limit = query?.limit ?? (items.length || 1);
    const totalItems = items.length;

    return {
      items,
      meta: buildMeta({ page, limit, totalItems, orderBy, orderDir, q: query?.q, filters }),
    };
  }

  @Roles('coordinator','revisor')
  @Get('patient/:id')
  async listByPatient(@Param('id', ParseIntPipe) id: number, @Query() query: ListQueryDto) {
    const items = await this.service.listByPatient(id);
    const orderBy = query.orderBy || 'date';
    const orderDir = normOrderDir(query.orderDir, 'DESC');
    const page = query.page ?? 1;
    const limit = query.limit ?? (items.length || 1);
    const totalItems = items.length;

    return {
      items,
      meta: buildMeta({ page, limit, totalItems, orderBy, orderDir, q: query.q, filters: { idPatient: id } }),
    };
  }

  @Roles('coordinator','revisor')
  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.getIfStaffAllowed(id, req.user);
  }
}
