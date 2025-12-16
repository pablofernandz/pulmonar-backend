import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Revisor } from './revisor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Revisor])],
  exports: [TypeOrmModule],
})
export class RevisoresModule {}
