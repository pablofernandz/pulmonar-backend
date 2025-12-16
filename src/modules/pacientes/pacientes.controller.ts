import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { PacientesService } from './pacientes.service';
import { CreatePacienteDto } from './dtos/create-paciente.dto';
import { UpdatePacienteDto } from './dtos/update-paciente.dto';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { ListQueryDto } from '../../common/pagination/list-query.dto';
import { buildMeta, normOrderDir } from '../../common/pagination/pagination.util';

@ApiTags('pacientes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('pacientes')
export class PacientesController {
  constructor(private readonly service: PacientesService) {}

  @Roles('coordinator')
  @Post()
  create(@Body() dto: CreatePacienteDto) {
    return this.service.create(dto);
  }

  @Roles('coordinator', 'revisor')
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'q', required: false, description: 'búsqueda libre' })
  @ApiQuery({ name: 'orderBy', required: false, example: 'id' })
  @ApiQuery({ name: 'orderDir', required: false, example: 'ASC', enum: ['ASC', 'DESC'] })
  @Get()

@Get()
async findAll(@Query() query: ListQueryDto) {
  const orderBy = (query.orderBy?.toString().toLowerCase() as any) || 'id';
  const orderDir = normOrderDir(query.orderDir, 'ASC');

  const items: any[] = await this.service.findAll(orderBy, orderDir);

  const page = query.page ?? 1;
  const limit = query.limit ?? (items.length || 1);
  const totalItems = items.length;

  return {
    items,
    meta: buildMeta({ page, limit, totalItems, orderBy, orderDir, q: query.q }),
  };
}


  @Roles('coordinator', 'revisor')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Roles('coordinator')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePacienteDto) {
    return this.service.update(id, dto);
  }

  @Roles('coordinator')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
