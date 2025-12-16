import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { UsersService } from './users.service';

import { SearchUsersDto } from './dtos/search-users.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { UpdateRolesDto } from './dtos/update-roles.dto';
import { UpdateUserGroupsDto } from './dtos/update-user-groups.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateSelfDto } from './dtos/update-self.dto';
import { SetPasswordDto } from './dtos/set-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @Roles('coordinator')
  @ApiBody({
    description:
      'Crea un usuario. Para crear un TUTOR/REVISOR y asignarlo a varios grupos en una sola llamada: enviar "revisor": true y "groupsRevisor": number[]. (Compatibilidad: "groupRevisorId" para modo exclusivo).',
    schema: {
      type: 'object',
      properties: {
        dni: { type: 'string' },
        name: { type: 'string' },
        last_name_1: { type: 'string' },
        last_name_2: { type: 'string', nullable: true },
        mail: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        birthday: { type: 'string', format: 'date', nullable: true },
        sex: { type: 'string', nullable: true },
        password: { type: 'string' },
        isValidate: { type: 'boolean', nullable: true },

        patient: { type: 'boolean', nullable: true },
        revisor: { type: 'boolean', nullable: true },
        coordinator: { type: 'boolean', nullable: true },

        groupPatientId: { type: 'integer', nullable: true },
        groupRevisorId: { type: 'integer', nullable: true },
        groupsRevisor: {
          type: 'array',
          nullable: true,
          items: { type: 'integer' },
          description: 'IDs de grupos donde será TUTOR/REVISOR (multi-grupo).',
        },
      },
      required: ['dni', 'name', 'last_name_1', 'password'],
      example: {
        dni: '12345678Z',
        name: 'María',
        last_name_1: 'López',
        mail: 'maria@example.com',
        password: 'Secreta123!',
        revisor: true,
        groupsRevisor: [3, 5, 7],
      },
    },
  })
  async create(@Body() dto: CreateUserDto) {
    const u = await this.users.createUser(dto);
    return { ok: true, id: u.id };
  }

  @Put('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateSelfDto) {
    const meId = Number(req.user?.sub);
    return this.users.updateUserData(meId, dto as any);
  }

  @Get()
  @Roles('coordinator', 'revisor')
  search(@Query() dto: SearchUsersDto) {
    return this.users.searchUsersPaginated(dto);
  }

  @Get(':id')
  @Roles('coordinator', 'revisor')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.getUserDetail(id);
  }

  @Get(':id/available-surveys')
  @Roles('coordinator', 'revisor')
  getAvailableSurveys(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.users.getAvailableSurveysForPatient(id, req.user);
  }

  @Put(':id')
  @Roles('coordinator')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.updateUserData(id, dto as any);
  }

  @Put(':id/roles')
  @Roles('coordinator')
  setRoles(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRolesDto) {
    return this.users.setRoles(id, dto as any);
  }

  @Put(':id/groups')
  @Roles('coordinator')
  setGroups(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserGroupsDto) {
    return this.users.updateUserGroups(id, dto as any);
  }

  @Delete(':id')
  @Roles('coordinator')
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.users.deleteUserLogical(id);
  }

  @Put(':id/password')
  @Roles('coordinator')
  async setPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPasswordDto,
  ) {
    await this.users.setPassword(id, dto.newPassword);
    return { ok: true, id };
  }
}
