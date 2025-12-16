import { DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const isTrue = (v?: string) => String(v ?? '').toLowerCase() === 'true';

export const getDataSourceOptions = (): DataSourceOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'tfg_pulmonar',
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  synchronize: false,
  migrationsRun: false,
  charset: 'utf8mb4_unicode_ci',
  logging: isTrue(process.env.DB_LOGGING) ? ['error', 'warn', 'query'] : ['error', 'warn'],
});

export const getTypeOrmModuleOptions = (): TypeOrmModuleOptions => ({
  ...getDataSourceOptions(),
  autoLoadEntities: true,
  retryAttempts: 3,
  retryDelay: 3000,
});

