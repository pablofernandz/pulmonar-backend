import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDataSourceOptions } from './config/ormconfig';

const dataSource = new DataSource(getDataSourceOptions());
export default dataSource;
