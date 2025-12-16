import {
  Controller, Post, Body, UseGuards, Get, Req, Query, Param, ParseIntPipe, Delete, Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dtos/create-group.dto';
import { AddPatientDto } from './dtos/add-patient.dto';
import { AddRevisorDto } from './dtos/add-revisor.dto';
import { UpdateGroupDto } from './dtos/update-group.dto';


@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}

  @Roles('coordinator')
  @Post()
  @ApiOperation({ summary: 'Crear grupo (name, story y revision OBLIGATORIOS)' })
  @ApiBody({
    description: 'Crea un grupo y vincula Historia (story) y Revisión (revision) en un solo paso.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 45 },
        story: { type: 'integer', description: 'ID de encuesta de Historia' },
        revision: { type: 'integer', description: 'ID de encuesta de Revisión' },
      },
      required: ['name', 'story', 'revision'],
      example: { name: 'Grupo A', story: 12, revision: 34 },
    },
  })
  create(@Body() dto: CreateGroupDto) {
    return this.service.create(dto);
  }

  @Roles('coordinator')
  @Post('add-patient')
  addPatient(@Body() dto: AddPatientDto) {
    return this.service.addPatient(dto);
  }

  @Roles('coordinator')
  @Post('add-revisor')
  addRevisor(@Body() dto: AddRevisorDto) {
    return this.service.addRevisor(dto);
  }

@Get()
list(
  @Req() req: any,
  @Query('q') q?: string,
) {
  return this.service.listGroupsFor(req.user, q);
}


  @Roles('coordinator', 'revisor')
  @Get(':id/members')
  members(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.membersFor(req.user, id);
  }

  @Roles('coordinator')
  @Delete(':id/patient/:idPaciente')
  removePatient(@Param('id', ParseIntPipe) id: number, @Param('idPaciente', ParseIntPipe) idPaciente: number) {
    return this.service.removePatient(id, idPaciente);
  }

  @Roles('coordinator')
  @Delete(':id/revisor/:idRevisor')
  removeRevisor(@Param('id', ParseIntPipe) id: number, @Param('idRevisor', ParseIntPipe) idRevisor: number) {
    return this.service.removeRevisor(id, idRevisor);
  }

  @Roles('coordinator')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGroupDto) {
    return this.service.update(id, dto);
  }
}
