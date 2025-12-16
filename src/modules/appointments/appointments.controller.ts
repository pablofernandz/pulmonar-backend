import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Req,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { UpdateAppointmentDto } from './dtos/update-appointment.dto';
import { ListAppointmentsDto } from './dtos/list-appointments.dto';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Roles('coordinator', 'revisor', 'patient')
  @Get('statuses')
  listStatuses() {
    return this.service.listStatuses();
  }

  @Roles('coordinator', 'revisor')
  @Post()
  create(@Req() req: any, @Body() dto: CreateAppointmentDto) {
    return this.service.create(req.user, dto);
  }

  @Roles('coordinator', 'revisor', 'patient')
  @Get()
  list(@Req() req: any, @Query() q: ListAppointmentsDto) {
    return this.service.list(req.user, q);
  }

  @Roles('coordinator', 'revisor', 'patient')
  @Get(':id')
  getOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(req.user, id);
  }

  @Roles('coordinator', 'revisor')
  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.service.update(req.user, id, dto);
  }
}
