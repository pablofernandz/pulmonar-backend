import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coordinator } from './coordinator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Coordinator])],
  exports: [TypeOrmModule],
})
export class CoordinadoresModule {}
