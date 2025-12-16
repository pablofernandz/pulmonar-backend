import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { Group } from './group.entity';
import { GroupPatient } from './grouppatient.entity';
import { GroupRevisor } from './grouprevisor.entity';
import { User } from '../users/user.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { RevisoresModule } from '../revisores/revisores.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, GroupPatient, GroupRevisor, User, Paciente]),
    RevisoresModule, 
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}


