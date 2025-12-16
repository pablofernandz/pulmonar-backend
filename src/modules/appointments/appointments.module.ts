import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment } from './appointment.entity';
import { StatusAppointment } from './statusappointment.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Revisor } from '../revisores/revisor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, StatusAppointment, Paciente, Revisor])],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
