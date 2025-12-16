import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
  import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { Paciente } from './paciente.entity';
import { CreatePacienteDto } from './dtos/create-paciente.dto';
import { UpdatePacienteDto } from './dtos/update-paciente.dto';

// ------------------- Funciones auxiliares -------------------

function cap(s: string | undefined | null, n: number) {
  if (s == null) return s as any;
  const t = s.trim();
  return t.length > n ? t.slice(0, n) : t;
}

function partirApellidos(apellidos?: string): { last_name_1?: string; last_name_2?: string | null } {
  if (!apellidos) return {};
  const parts = apellidos.trim().split(/\s+/);
  const last_name_1 = cap(parts.shift() || '', 45) || undefined;
  const rest = parts.join(' ');
  const last_name_2 = rest ? cap(rest, 45) : null;
  return { last_name_1, last_name_2 };
}

function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function mapDuplicateError(e: any): never {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[DB ERROR]', { code: e?.code, errno: e?.errno, sqlState: e?.sqlState, sqlMessage: e?.sqlMessage, message: e?.message });
  }
  const code = e?.code || e?.errno;
  const msg: string = String(e?.sqlMessage || e?.message || e);

  if (code === 'ER_DUP_ENTRY' || msg.includes('Duplicate entry')) {
    if (msg.includes('dni'))  throw new ConflictException('El DNI ya existe');
    if (msg.includes('mail')) throw new ConflictException('El email ya existe');
    throw new ConflictException('Registro duplicado');
  }
  if (code === 'ER_NO_REFERENCED_ROW_2' || msg.includes('foreign key')) {
    throw new InternalServerErrorException('Error FK (revisa claves y tablas relacionadas)');
  }
  if (code === 'ER_TABLEACCESS_DENIED_ERROR' || msg.includes('denied')) {
    throw new InternalServerErrorException('Permisos de escritura denegados en la BD de pruebas');
  }
  if (code === 'ER_TRUNCATED_WRONG_VALUE' || msg.includes('Incorrect')) {
    throw new BadRequestException('Valor con formato incorrecto (fecha/número/campo)');
  }
  throw new InternalServerErrorException('Error al guardar');
}



@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Paciente) private readonly patients: Repository<Paciente>,
    private readonly dataSource: DataSource,
  ) {}

  private safe(u: User) {
    const { password, ...rest } = u as any;
    return rest;
  }

  
  private normSex(input: any): string | null | undefined {
    const raw = input?.sexo ?? input?.sex;
    if (raw === undefined) return undefined;                
    const v = String(raw).trim();
    if (!v) return null;                                    
    return cap(v, 45);
  }


  async create(dto: CreatePacienteDto) {
    if (!dto?.nif) throw new BadRequestException('nif requerido');

    const dni = cap(dto.nif?.toUpperCase(), 20)!;
    const name = cap(dto.nombre, 45) ?? '';
    const { last_name_1, last_name_2 } = partirApellidos(dto.apellidos);
    const birthday = dto.fechaNacimiento ?? undefined;
    const mail = cap(dto.mail?.toLowerCase(), 100);
    const sex = this.normSex(dto);

    return this.dataSource.transaction(async (m) => {
      const uRepo = m.getRepository(User);
      const pRepo = m.getRepository(Paciente);

      let user = await uRepo.findOne({ where: { dni } });

      if (user) {
        if (mail && mail !== user.mail) {
          const clash = await uRepo.findOne({ where: { mail } });
          if (clash) throw new ConflictException('El email ya existe');
        }

        const toUpdate = compact<Partial<User>>({
          name,
          last_name_1,
          last_name_2,
          birthday,
          mail,
          sex,
        });

        try {
          await uRepo.update({ id: user.id }, toUpdate);
        } catch (e) {
          mapDuplicateError(e);
        }
        user = await uRepo.findOneBy({ id: user.id });
      } else {
        if (!mail) throw new BadRequestException('email requerido');

        const [dniClash, mailClash] = await Promise.all([
          uRepo.findOne({ where: { dni } }),
          uRepo.findOne({ where: { mail } }),
        ]);
        if (dniClash) throw new ConflictException('El DNI ya existe');
        if (mailClash) throw new ConflictException('El email ya existe');

        const tempPass = 'Cambiar.123';
        const hashed = await bcrypt.hash(tempPass, 10);

        const nuevo = uRepo.create(
          compact<Partial<User>>({
            dni,
            name,
            last_name_1,
            last_name_2,
            birthday,
            mail,
            sex,            
            isValidate: true,
            password: hashed,
          }),
        );

        try {
          user = await uRepo.save(nuevo);
        } catch (e) {
          mapDuplicateError(e);
        }
      }

      if (!user) throw new InternalServerErrorException('No se pudo crear/actualizar el usuario');

      const existing = await pRepo.findOne({ where: { id: user.id } });
      if (!existing) {
        await pRepo.insert({ id: user.id, deleted: 0 });
      } else if (existing.deleted === 1) {
        await pRepo.update({ id: user.id }, { deleted: 0 });
      }

      return this.safe(user);
    });
  }

  
  async findAll(
    orderByInput:
      | 'id' | 'nif' | 'dni'
      | 'nombre' | 'name'
      | 'apellidos'
      | 'fechanacimiento' | 'birthday'
      | 'email' | 'mail' = 'id',
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ) {
    const orderBy = (orderByInput || 'id').toString().toLowerCase();

    const apellidosExpr =
      "CONCAT(IFNULL(u.last_name_1,''), CASE WHEN u.last_name_2 IS NULL OR u.last_name_2='' THEN '' ELSE ' ' END, IFNULL(u.last_name_2,''))";

    const qb = this.users
      .createQueryBuilder('u')
      .innerJoin(Paciente, 'p', 'p.id = u.id AND p.deleted = 0')
      .select([
        'u.id AS id',
        'u.dni AS nif',
        'u.name AS nombre',
        `${apellidosExpr} AS apellidos`,
        'u.birthday AS fechaNacimiento',
        'u.mail AS email',
      ]);

    const orderMap: Record<string, string> = {
      id: 'u.id',
      nif: 'u.dni',
      dni: 'u.dni',
      nombre: 'u.name',
      name: 'u.name',
      apellidos: apellidosExpr,
      fechanacimiento: 'u.birthday',
      birthday: 'u.birthday',
      email: 'u.mail',
      mail: 'u.mail',
    };

    const col = orderMap[orderBy] ?? 'u.id';
    qb.orderBy(col, orderDir);
    if (col !== 'u.id') qb.addOrderBy('u.id', 'ASC');

    return qb.getRawMany();
  }

  async findOne(id: number) {
    const row = await this.users
      .createQueryBuilder('u')
      .innerJoin(Paciente, 'p', 'p.id = u.id AND p.deleted = 0')
      .where('u.id = :id', { id })
      .select([
        'u.id AS id',
        'u.dni AS nif',
        'u.name AS nombre',
        'u.last_name_1 AS apellido1',
        'u.last_name_2 AS apellido2',
        'u.birthday AS fechaNacimiento',
        'u.mail AS email',
      ])
      .getRawOne();

    if (!row) throw new NotFoundException('Paciente no encontrado');
    row.apellidos = [row.apellido1, row.apellido2].filter(Boolean).join(' ') || null;
    delete row.apellido1;
    delete row.apellido2;
    return row;
  }

  async update(id: number, dto: UpdatePacienteDto) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Paciente no encontrado');

    const patch: Partial<User> = {};
    const sex = this.normSex(dto);

    if (dto.nif) {
      const dni = cap(dto.nif.toUpperCase(), 20)!;
      const other = await this.users.findOne({ where: { dni } });
      if (other && other.id !== id) throw new ConflictException('El DNI ya existe');
      patch.dni = dni;
    }

    if (dto.nombre) patch.name = cap(dto.nombre, 45)!;
    if (dto.apellidos !== undefined) Object.assign(patch, partirApellidos(dto.apellidos));
    if (dto.fechaNacimiento !== undefined) patch.birthday = dto.fechaNacimiento;
    if (sex !== undefined) patch.sex = sex; // solo si vino en DTO

    if ((dto as any).email) {
      const mail = cap((dto as any).email.toLowerCase(), 100)!;
      if (mail !== user.mail) {
        const clash = await this.users.findOne({ where: { mail } });
        if (clash && clash.id !== id) throw new ConflictException('El email ya existe');
      }
      patch.mail = mail;
    }

    try {
      await this.users.update({ id }, compact(patch));
    } catch (e) {
      mapDuplicateError(e);
    }

    if ((dto as any).deleted === 0 || (dto as any).deleted === 1) {
      const to = Number((dto as any).deleted);
      const existing = await this.patients.findOne({ where: { id } });
      if (existing) {
        if (existing.deleted !== to) {
          await this.patients.update({ id }, { deleted: to });
        }
      } else {
        await this.patients.insert({ id, deleted: to });
      }
    }

    const refreshed = await this.users.findOneBy({ id });
    if (!refreshed) throw new NotFoundException('Paciente no encontrado');

    return this.safe(refreshed);
  }


  async remove(id: number) {
    const result = await this.patients.update({ id }, { deleted: 1 });
    if (!result.affected) {
      await this.patients.insert({ id, deleted: 1 });
    }
    return { ok: true };
  }
}
