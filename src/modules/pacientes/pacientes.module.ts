import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';
import { Paciente } from './paciente.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Paciente])],
  controllers: [PacientesController],
  providers: [PacientesService],
  exports: [PacientesService],
})
export class PacientesModule {}

