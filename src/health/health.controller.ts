import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}

  @Get('liveness')
  liveness() {
    return { ok: true, ts: new Date().toISOString() };
  }


  @Get('readiness')
  async readiness() {
    try {
      const [info] = await this.ds.query(`
        SELECT
          DATABASE()   AS db,
          @@hostname   AS host,
          @@port       AS port,
          @@version    AS version
    ` );
      return { db: 'up', info };
    } catch (e: any) {
       throw new ServiceUnavailableException({
       db: 'down',
       error: e?.code || e?.errno || 'DB_CONNECTION_ERROR',
       message: e?.message || 'Database not reachable',
       });
      }
  }

} 
