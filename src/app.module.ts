import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTypeOrmModuleOptions } from './config/ormconfig';

import { HealthModule } from './health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PacientesModule } from './modules/pacientes/pacientes.module';
import { AuthModule } from './modules/auth/auth.module';
import { GroupsModule } from './modules/groups/groups.module';
import { SurveysModule } from './modules/surveys/surveys.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StatsModule } from './modules/stats/stats.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: getTypeOrmModuleOptions }),
    HealthModule,
    AuthModule,
    UsersModule,
    PacientesModule,
    GroupsModule,
    SurveysModule,
    EvaluationsModule,
    AppointmentsModule,
    NotificationsModule,
    StatsModule,
  ],
})
export class AppModule {}
