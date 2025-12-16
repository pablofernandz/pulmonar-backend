import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { User } from './user.entity';
import { SearchUsersDto } from './dtos/search-users.dto';
import { CreateUserDto } from './dtos/create-user.dto';

type SearchUsersNodeParams = {
  q?: string;           
  dni?: string;
  email?: string;       
  name?: string;
  last_name?: string;   
  grupoPacientes?: number; 
  grupoTutores?: number;  
  fc_inicio?: string;   
  fc_fin?: string;      
};

type UpdateUserNodeDto = {
  mail?: string;
  name?: string;
  last_name_1?: string;
  last_name_2?: string;
  phone?: string;
  birthday?: string; 
  pass?: string;     
};

type UpdateRolesNodeDto = {
  patient?: boolean;
  revisor?: boolean;
  coordinator?: boolean;
};

type UpdateGroupsNodeDto = {
  groupPatientId?: number | null;
  groupRevisorId?: number | null;
  groupsPatient?: number[];
  groupsRevisor?: number[];
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly ds: DataSource,
  ) {}
  

  // ------------------ Funciones auxiliares ----------------------

  private isBcrypt(hash?: string | null) { return !!hash && /^\$2[aby]\$/.test(hash); }
  private isSha256(hash?: string | null) { return !!hash && /^[a-f0-9]{64}$/i.test(hash); }
  private isMd5(hash?: string | null)    { return !!hash && /^[a-f0-9]{32}$/i.test(hash); }

  private normDni(s?: string) { return (s ?? '').trim().toUpperCase(); }
  private normMail(s?: string | null) { return s ? s.trim().toLowerCase() : s ?? null; }

  async findByDni(dni: string, opts?: { withPassword?: boolean }) {
    const qb = this.repo.createQueryBuilder('user').where('user.dni = :dni', { dni });
    if (opts?.withPassword) qb.addSelect('user.password');
    return qb.getOne();
  }

  async findById(id: number, opts?: { withPassword?: boolean }) {
    const qb = this.repo.createQueryBuilder('user').where('user.id = :id', { id });
    if (opts?.withPassword) qb.addSelect('user.password');
    return qb.getOne();
  }

  findByMail(mail: string) { return this.repo.findOne({ where: { mail } }); }


  async validatePassword(user: any, plain: string) {
    const storedRaw = user?.password as string | undefined;
    if (!storedRaw) return false;

    const stored = storedRaw.toString();
    const lower = stored.toLowerCase();

    try {
      if (this.isBcrypt(stored)) {
        const ok = await bcrypt.compare(plain, stored);
        if (ok) return true;
      }
    } catch {}

    try {
      const sha = createHash('sha256').update(plain).digest('hex');
      if (sha === lower) return true;
    } catch {}

    if ((process.env.ALLOW_MD5_LOGIN || '').toLowerCase() === 'true') {
      try {
        const md5 = createHash('md5').update(plain).digest('hex');
        if (md5 === lower) return true;
      } catch {}
    }

    return false;
  }

  async rehashIfLegacy(user: User, plain: string): Promise<void> {
    if ((process.env.AUTH_REHASH_ON_LOGIN || '').toLowerCase() !== 'true') return;

    const currentRaw = (user as any)?.password ?? '';
    const current = currentRaw.toString();
    if (!current || this.isBcrypt(current)) return;

    const lower = current.toLowerCase();
    const sha = createHash('sha256').update(plain).digest('hex');
    const allowMd5 = (process.env.ALLOW_MD5_LOGIN || '').toLowerCase() === 'true';
    const md5 = allowMd5 ? createHash('md5').update(plain).digest('hex') : '';

    if (lower === sha || (allowMd5 && lower === md5)) {
      await this.setPassword(user.id, plain); 
    }
  }

  async setPassword(userId: number, newPlain: string): Promise<void> {
    const hash = await bcrypt.hash(newPlain, 10);
    await this.repo.update({ id: userId }, { password: hash });
  }


  async getRoles(userId: number) {
    const q = (sql: string, p: any[]) => this.repo.query(sql, p);
    const [patient, revisor, coordinator] = await Promise.all([
      q('SELECT EXISTS(SELECT 1 FROM `patient`     WHERE id = ? AND deleted = 0) AS ok', [userId]),
      q('SELECT EXISTS(SELECT 1 FROM `revisor`     WHERE id = ? AND deleted = 0) AS ok', [userId]),
      q('SELECT EXISTS(SELECT 1 FROM `coordinator` WHERE id = ? AND deleted = 0) AS ok', [userId]),
    ]);
    return {
      patient: !!Number(patient?.[0]?.ok ?? 0),
      revisor: !!Number(revisor?.[0]?.ok ?? 0),
      coordinator: !!Number(coordinator?.[0]?.ok ?? 0),
    };
  }

  async searchUsers(dto: Partial<SearchUsersNodeParams>) {
    const where: string[] = [];
    const params: any[] = [];

    if (dto.dni) { where.push('u.dni = ?'); params.push(dto.dni); }
    if (dto.email) { where.push('u.mail = ?'); params.push(dto.email); }
    if (dto.name) { where.push('u.name LIKE ?'); params.push(`%${dto.name}%`); }
    if (dto.last_name) {
      where.push('(u.last_name_1 LIKE ? OR u.last_name_2 LIKE ?)'); 
      params.push(`%${dto.last_name}%`, `%${dto.last_name}%`);
    }

    if (dto.q) {
      const like = `%${dto.q}%`;
      where.push('(u.name LIKE ? OR u.last_name_1 LIKE ? OR u.last_name_2 LIKE ? OR u.mail LIKE ? OR u.dni = ?)');
      params.push(like, like, like, like, dto.q);
    }

    if (dto.fc_inicio) { where.push('u.date_insert >= ?'); params.push(dto.fc_inicio); }
    if (dto.fc_fin)    { where.push('u.date_insert <= ?'); params.push(dto.fc_fin); }

    if (dto.grupoPacientes !== undefined) {
      const v = Number(dto.grupoPacientes);
      if (v === -1) where.push('NOT EXISTS (SELECT 1 FROM `patient` p WHERE p.id = u.id AND p.deleted = 0)');
      else if (v === 0) where.push('EXISTS (SELECT 1 FROM `patient` p WHERE p.id = u.id AND p.deleted = 0)');
      else if (v > 0) {
        where.push('EXISTS (SELECT 1 FROM `grouppatient` gp WHERE gp.idPatient = u.id AND gp.idGroup = ? AND gp.deleted = 0)');
        params.push(v);
      }
    }
    if (dto.grupoTutores !== undefined) {
      const v = Number(dto.grupoTutores);
      if (v === -1) where.push('NOT EXISTS (SELECT 1 FROM `revisor` r WHERE r.id = u.id AND r.deleted = 0)');
      else if (v === 0) where.push('EXISTS (SELECT 1 FROM `revisor` r WHERE r.id = u.id AND r.deleted = 0)');
      else if (v > 0) {
        where.push('EXISTS (SELECT 1 FROM `grouprevisor` gr WHERE gr.idRevisor = u.id AND gr.idGroup = ? AND gr.deleted = 0)');
        params.push(v);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.repo.query(
      `SELECT
         u.id, u.name, u.last_name_1, u.last_name_2, u.dni, u.mail, u.phone, u.birthday, u.isValidate, u.date_insert,
         EXISTS (SELECT 1 FROM \`patient\`     p WHERE p.id = u.id AND p.deleted = 0) AS isPatient,
         EXISTS (SELECT 1 FROM \`revisor\`     r WHERE r.id = u.id AND r.deleted = 0) AS isRevisor,
         EXISTS (SELECT 1 FROM \`coordinator\` c WHERE c.id = u.id AND c.deleted = 0) AS isCoordinator
       FROM \`user\` u
       ${whereSql}`,
      params,
    );

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      last_name_1: r.last_name_1,
      last_name_2: r.last_name_2,
      dni: r.dni,
      mail: r.mail,
      phone: r.phone,
      birthday: r.birthday,
      isValidate: !!Number(r.isValidate),
      date_insert: r.date_insert,
      roles: {
        patient: !!Number(r.isPatient),
        revisor: !!Number(r.isRevisor),
        coordinator: !!Number(r.isCoordinator),
      },
    }));
  }

  async getUserDetail(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const roles = await this.getRoles(id);

    const [gp, gr] = await Promise.all([
      this.repo.query(
        `SELECT g.id, g.name
           FROM \`grouppatient\` gp
           JOIN \`group\` g ON g.id = gp.idGroup
          WHERE gp.idPatient = ? AND gp.deleted = 0`,
        [id],
      ),
      this.repo.query(
        `SELECT g.id, g.name
           FROM \`grouprevisor\` gr
           JOIN \`group\` g ON g.id = gr.idGroup
          WHERE gr.idRevisor = ? AND gr.deleted = 0`,
        [id],
      ),
    ]);

    return {
      id: user.id,
      name: user.name,
      last_name_1: (user as any).last_name_1,
      last_name_2: (user as any).last_name_2,
      dni: user.dni,
      mail: (user as any).mail,
      phone: (user as any).phone ?? null,
      birthday: (user as any).birthday ?? null,
      isValidate: !!Number((user as any).isValidate ?? 0),
      date_insert: (user as any).date_insert,
      roles,
      groups: {
        asPatient: gp, 
        asRevisor: gr, 
      },
    };
  }

  async updateUserData(id: number, dto: Partial<UpdateUserNodeDto>) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.mail !== undefined) {
      dto.mail = this.normMail(dto.mail) ?? undefined;
    }
    if (dto.mail && dto.mail !== (user as any).mail) {
      const clash = await this.repo.findOne({ where: { mail: dto.mail } });
      if (clash) throw new BadRequestException('Ese correo ya está en uso');
    }

    const patch: any = {};
    if (dto.mail !== undefined)        patch.mail = dto.mail;
    if (dto.name !== undefined)        patch.name = dto.name;
    if (dto.last_name_1 !== undefined) patch.last_name_1 = dto.last_name_1;
    if (dto.last_name_2 !== undefined) patch.last_name_2 = dto.last_name_2;
    if (dto.phone !== undefined)       patch.phone = dto.phone;
    if (dto.birthday !== undefined)    patch.birthday = dto.birthday;

    await this.repo.update({ id }, patch);

    if (dto.pass) await this.setPassword(id, dto.pass);

    return { ok: true, id };
  }

  async setRoles(id: number, dto: Partial<UpdateRolesNodeDto>) {
    const exists = await this.repo.findOne({ where: { id } });
    if (!exists) throw new NotFoundException('Usuario no encontrado');

    await this.ds.transaction(async (trx) => {
      const q = (sql: string, p: any[]) => trx.query(sql, p);

      if (dto.patient !== undefined) {
        if (dto.patient) {
          await q('INSERT INTO `patient` (id, deleted) VALUES (?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [id]);
        } else {
          await q('UPDATE `patient` SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);
          await q('UPDATE `grouppatient` SET deleted = 1 WHERE idPatient = ? AND deleted = 0', [id]);
        }
      }

      if (dto.revisor !== undefined) {
        if (dto.revisor) {
          await q('INSERT INTO `revisor` (id, deleted) VALUES (?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [id]);
        } else {
          await q('UPDATE `revisor` SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);
          await q('UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND deleted = 0', [id]);
        }
      }

      if (dto.coordinator !== undefined) {
        if (dto.coordinator) {
          await q('INSERT INTO `coordinator` (id, deleted) VALUES (?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [id]);
        } else {
          await q('UPDATE `coordinator` SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);
        }
      }
    });

    return { ok: true, id };
  }


  async updateUserGroups(id: number, dto: Partial<UpdateGroupsNodeDto>) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const patientId =
      dto.groupPatientId ??
      (Array.isArray(dto.groupsPatient) ? dto.groupsPatient[0] ?? null : undefined);

    const revisorSingle =
      dto.groupRevisorId ??
      (Array.isArray(dto.groupsRevisor) ? dto.groupsRevisor[0] ?? null : undefined);

    const hasRevisorPayload =
      dto.groupRevisorId !== undefined || dto.groupsRevisor !== undefined;

    const roles = await this.getRoles(id);
    if (patientId !== undefined && !roles.patient) {
      throw new BadRequestException('No puedes asignar grupo de paciente a un usuario sin rol patient');
    }
    if (hasRevisorPayload && !roles.revisor) {
      throw new BadRequestException('No puedes asignar grupos de revisor a un usuario sin rol revisor');
    }

    await this.ds.transaction(async (trx) => {
      const q = (sql: string, p: any[]) => trx.query(sql, p);

      if (patientId !== undefined) {
        if (patientId === null) {
          await q('UPDATE `grouppatient` SET deleted = 1 WHERE idPatient = ? AND deleted = 0', [id]);
        } else {
          const g = await q('SELECT id FROM `group` WHERE id = ? LIMIT 1', [patientId]);
          if (!g?.length) throw new BadRequestException(`Grupo inexistente: ${patientId}`);

          await q(
            'INSERT INTO `grouppatient` (idGroup, idPatient, deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE deleted = 0',
            [patientId, id],
          );
          await q(
            'UPDATE `grouppatient` SET deleted = 1 WHERE idPatient = ? AND idGroup <> ? AND deleted = 0',
            [id, patientId],
          );
        }
      }

      if (dto.groupsRevisor !== undefined) {
        const arr = dto.groupsRevisor;

        if (!Array.isArray(arr)) {
          throw new BadRequestException('groupsRevisor debe ser un array de IDs');
        }

        if (arr.length === 0) {
          await q('UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND deleted = 0', [id]);
        } else {
          const uniq = Array.from(new Set(arr.map((n) => Number(n)).filter(Number.isFinite)));
          if (!uniq.length) throw new BadRequestException('groupsRevisor no contiene IDs válidos');

          const placeholders = uniq.map(() => '?').join(',');
          const existing = await q(`SELECT id FROM \`group\` WHERE id IN (${placeholders})`, uniq);
          const existingIds = new Set(existing.map((r: any) => Number(r.id)));
          const missing = uniq.filter((g) => !existingIds.has(g));
          if (missing.length) throw new BadRequestException(`Grupos inexistentes: ${missing.join(', ')}`);

          for (const gid of uniq) {
            await q(
              'INSERT INTO `grouprevisor` (idGroup, idRevisor, deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE deleted = 0',
              [gid, id],
            );
          }
        }
      } else if (dto.groupRevisorId !== undefined) {
        const revisorId = dto.groupRevisorId;
        if (revisorId === null) {
          await q('UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND deleted = 0', [id]);
        } else {
          const g = await q('SELECT id FROM `group` WHERE id = ? LIMIT 1', [revisorId]);
          if (!g?.length) throw new BadRequestException(`Grupo inexistente: ${revisorId}`);

          await q(
            'INSERT INTO `grouprevisor` (idGroup, idRevisor, deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE deleted = 0',
            [revisorId, id],
          );
          await q(
            'UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND idGroup <> ? AND deleted = 0',
            [id, revisorId],
          );
        }
      }
    });

    return { ok: true, id };
  }


  async searchUsersPaginated(dto: SearchUsersDto) {
    const rawOrder = (dto.order || 'desc').toLowerCase();
    const dir = rawOrder === 'asc' ? 'ASC' : 'DESC';

    const sortMap = {
      date_insert: 'u.date_insert',
      name: 'u.name',
      last_name_1: 'u.last_name_1',
      dni: 'u.dni',
      mail: 'u.mail',
    } as const;
    const sortKey = (dto.sort || 'date_insert') as keyof typeof sortMap;
    const sortCol = sortMap[sortKey] ?? 'u.date_insert';

    const page = Math.max(1, Number(dto.page ?? 1));
    const limit = Math.max(1, Math.min(Number(dto.limit ?? 20), 100)); 

    const where: string[] = [];
    const params: any[] = [];

    if (dto.q) {
      const like = `%${dto.q}%`;
      where.push('(u.name LIKE ? OR u.last_name_1 LIKE ? OR u.last_name_2 LIKE ? OR u.mail LIKE ? OR u.dni = ?)');
      params.push(like, like, like, like, dto.q);
    }

    if (dto.role === 'patient')    where.push('EXISTS (SELECT 1 FROM `patient` p WHERE p.id = u.id AND p.deleted = 0)');
    if (dto.role === 'revisor')    where.push('EXISTS (SELECT 1 FROM `revisor` r WHERE r.id = u.id AND r.deleted = 0)');
    if (dto.role === 'coordinator')where.push('EXISTS (SELECT 1 FROM `coordinator` c WHERE c.id = u.id AND c.deleted = 0)');

    if (dto.groupPatientId) {
      where.push('EXISTS (SELECT 1 FROM `grouppatient` gp WHERE gp.idPatient = u.id AND gp.idGroup = ? AND gp.deleted = 0)');
      params.push(dto.groupPatientId);
    }
    if (dto.groupRevisorId) {
      where.push('EXISTS (SELECT 1 FROM `grouprevisor` gr WHERE gr.idRevisor = u.id AND gr.idGroup = ? AND gr.deleted = 0)');
      params.push(dto.groupRevisorId);
    }

    if (dto.from) { where.push('u.date_insert >= ?'); params.push(dto.from); }
    if (dto.to)   { where.push('u.date_insert <= ?'); params.push(dto.to); }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await this.repo.query(`SELECT COUNT(*) AS cnt FROM \`user\` u ${whereSql}`, params);
    const total = Number(totalRow?.[0]?.cnt ?? 0);

    const rows = await this.repo.query(
      `SELECT
         u.id, u.name, u.last_name_1, u.last_name_2, u.dni, u.mail, u.phone, u.birthday, u.isValidate, u.date_insert,
         EXISTS (SELECT 1 FROM \`patient\`     p WHERE p.id = u.id AND p.deleted = 0) AS isPatient,
         EXISTS (SELECT 1 FROM \`revisor\`     r WHERE r.id = u.id AND r.deleted = 0) AS isRevisor,
         EXISTS (SELECT 1 FROM \`coordinator\` c WHERE c.id = u.id AND c.deleted = 0) AS isCoordinator
       FROM \`user\` u
       ${whereSql}
       ORDER BY ${sortCol} ${dir}, u.id ${dir}
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    const data = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      last_name_1: r.last_name_1,
      last_name_2: r.last_name_2,
      dni: r.dni,
      mail: r.mail,
      phone: r.phone,
      birthday: r.birthday,
      isValidate: !!Number(r.isValidate),
      date_insert: r.date_insert,
      roles: {
        patient: !!Number(r.isPatient),
        revisor: !!Number(r.isRevisor),
        coordinator: !!Number(r.isCoordinator),
      },
    }));

    return { data, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
  }


  async createUser(dto: CreateUserDto) {
    const dni = this.normDni(dto.dni);
    const mail = this.normMail(dto.mail);
    if (!dni) throw new BadRequestException('DNI requerido');

    const clashDni = await this.repo.findOne({ where: { dni } });
    if (clashDni) throw new BadRequestException('DNI ya existe');
    if (mail) {
      const clashMail = await this.repo.findOne({ where: { mail } });
      if (clashMail) throw new BadRequestException('Correo ya existe');
    }

    const passHash = await bcrypt.hash(dto.password, 10);
    const isValidate = dto.isValidate ?? true;

    return await this.ds.transaction(async (trx) => {
      const q = (sql: string, p: any[]) => trx.query(sql, p);

      const res: any = await q(
        `INSERT INTO \`user\`
           (name, last_name_1, last_name_2, dni, mail, phone, birthday, sex, password, isValidate, date_insert)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          dto.name,
          dto.last_name_1,
          dto.last_name_2 ?? null,
          dni,
          mail ?? null,
          dto.phone ?? null,
          dto.birthday ?? null,
          dto.sex ?? null,
          passHash,
          isValidate ? 1 : 0,
        ],
      );
      const id = res.insertId;

      if (dto.patient)     await q('INSERT INTO `patient` (id, deleted) VALUES (?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [id]);
      if (dto.revisor)     await q('INSERT INTO `revisor` (id, deleted) VALUES (?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [id]);
      if (dto.coordinator) await q('INSERT INTO `coordinator` (id, deleted) VALUES (?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [id]);

      if (dto.groupPatientId !== undefined) {
        if (!dto.patient) throw new BadRequestException('Para asignar groupPatientId debes activar el rol patient');
        if (dto.groupPatientId === null) {
          await q('UPDATE `grouppatient` SET deleted = 1 WHERE idPatient = ? AND deleted = 0', [id]);
        } else {
          const g = await q('SELECT id FROM `group` WHERE id = ? LIMIT 1', [dto.groupPatientId]);
          if (!g?.length) throw new BadRequestException(`Grupo inexistente: ${dto.groupPatientId}`);
          await q('INSERT INTO `grouppatient` (idGroup, idPatient, deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE deleted = 0', [dto.groupPatientId, id]);
          await q('UPDATE `grouppatient` SET deleted = 1 WHERE idPatient = ? AND idGroup <> ? AND deleted = 0', [id, dto.groupPatientId]);
        }
      }

      const groupsRevisor = (dto as any)?.groupsRevisor as unknown;
      if (groupsRevisor !== undefined) {
        if (!dto.revisor) throw new BadRequestException('Para asignar groupsRevisor debes activar el rol revisor');
        if (!Array.isArray(groupsRevisor)) {
          throw new BadRequestException('groupsRevisor debe ser un array de IDs');
        }

        const uniq = Array.from(new Set(groupsRevisor.map((n: any) => Number(n)).filter(Number.isFinite)));
        if (uniq.length > 0) {
          const placeholders = uniq.map(() => '?').join(',');
          const existing = await q(`SELECT id FROM \`group\` WHERE id IN (${placeholders})`, uniq);
          const existingIds = new Set(existing.map((r: any) => Number(r.id)));
          const missing = uniq.filter((g: number) => !existingIds.has(g));
          if (missing.length) throw new BadRequestException(`Grupos inexistentes: ${missing.join(', ')}`);

          for (const gid of uniq) {
            await q(
              'INSERT INTO `grouprevisor` (idGroup, idRevisor, deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE deleted = 0',
              [gid, id],
            );
          }
        } 
      }

      if (dto.groupRevisorId !== undefined) {
        if (!dto.revisor) throw new BadRequestException('Para asignar groupRevisorId debes activar el rol revisor');
        if (dto.groupRevisorId === null) {
          await q('UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND deleted = 0', [id]);
        } else {
          const g = await q('SELECT id FROM `group` WHERE id = ? LIMIT 1', [dto.groupRevisorId]);
          if (!g?.length) throw new BadRequestException(`Grupo inexistente: ${dto.groupRevisorId}`);
          await q(
            'INSERT INTO `grouprevisor` (idGroup, idRevisor, deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE deleted = 0',
            [dto.groupRevisorId, id],
          );
          await q(
            'UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND idGroup <> ? AND deleted = 0',
            [id, dto.groupRevisorId],
          );
        }
      }

      return { id, dni, mail };
    });
  }


  async deleteUserLogical(id: number) {
    const exists = await this.repo.findOne({ where: { id } });
    if (!exists) throw new NotFoundException('Usuario no encontrado');

    return await this.ds.transaction(async (trx) => {
      const q = (sql: string, p: any[]) => trx.query(sql, p);

      const upUser: any = await q('UPDATE `user` SET isValidate = 0 WHERE id = ? AND (isValidate IS NULL OR isValidate <> 0)', [id]);

      const upPat: any = await q('UPDATE `patient` SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);
      const upRev:  any = await q('UPDATE `revisor` SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);
      const upCoo:  any = await q('UPDATE `coordinator` SET deleted = 1 WHERE id = ? AND deleted = 0', [id]);

      const upGp: any = await q('UPDATE `grouppatient` SET deleted = 1 WHERE idPatient = ? AND deleted = 0', [id]);
      const upGr: any = await q('UPDATE `grouprevisor` SET deleted = 1 WHERE idRevisor = ? AND deleted = 0', [id]);

      const changed =
        (upUser?.affectedRows ?? upUser?.affected ?? 0) +
        (upPat?.affectedRows ?? upPat?.affected ?? 0) +
        (upRev?.affectedRows ?? upRev?.affected ?? 0) +
        (upCoo?.affectedRows ?? upCoo?.affected ?? 0) +
        (upGp?.affectedRows ?? upGp?.affected ?? 0) +
        (upGr?.affectedRows ?? upGr?.affected ?? 0) > 0;

      return { ok: true, id, changed };
    });
  }


async getAvailableSurveysForPatient(
  idPatient: number,
  requester: { id: number; roles: { coordinator?: boolean; revisor?: boolean; patient?: boolean } },
) {
  const [pat] = await this.ds.query(
    'SELECT 1 AS ok FROM `patient` WHERE id = ? AND deleted = 0 LIMIT 1',
    [idPatient],
  );
  if (!pat) throw new NotFoundException('Paciente no encontrado o inactivo');

  const [g] = await this.ds.query(
    `SELECT g.id, g.name, g.story, g.revision
       FROM \`grouppatient\` gp
       INNER JOIN \`group\` g ON g.id = gp.idGroup
      WHERE gp.idPatient = ? AND gp.deleted = 0
      LIMIT 1`,
    [idPatient],
  );

  const group = g
    ? {
        id: Number(g.id),
        name: String(g.name),
        story: g.story != null ? Number(g.story) : null,
        revision: g.revision != null ? Number(g.revision) : null,
      }
    : null;

  if (!requester?.roles?.coordinator && requester?.roles?.revisor) {
    if (!group) throw new ForbiddenException('El paciente no tiene grupo activo');
    const [shared] = await this.ds.query(
      `SELECT 1 AS ok
         FROM \`grouprevisor\` gr
        WHERE gr.idGroup = ? AND gr.idRevisor = ? AND gr.deleted = 0
        LIMIT 1`,
      [group.id, requester.id],
    );
    if (!shared) throw new ForbiddenException('No compartes grupo con el paciente');
  } else if (!requester?.roles?.coordinator && !requester?.roles?.revisor) {
    throw new ForbiddenException();
  }

  let story: { id: number; name: string | null } | null = null;
  let revision: { id: number; name: string | null } | null = null;

  if (group) {
    const ids: number[] = [];
    const storyId = Number(group.story ?? 0) || null;
    const revisionId = Number(group.revision ?? 0) || null;

    if (storyId) ids.push(storyId);
    if (revisionId && revisionId !== storyId) ids.push(revisionId);

    let rows: any[] = [];
    if (ids.length) {
      rows = await this.ds.query(
        `SELECT id, name
           FROM \`survey\`
          WHERE deleted = 0
            AND id IN (${ids.map(() => '?').join(',')})`,
        ids,
      );
    }
    const byId = new Map<number, any>(rows.map(r => [Number(r.id), r]));
    if (storyId)   story   = byId.get(storyId)   ? { id: storyId,   name: byId.get(storyId).name ?? null }   : null;
    if (revisionId) revision = byId.get(revisionId) ? { id: revisionId, name: byId.get(revisionId).name ?? null } : null;
  }

  return {
    patientId: idPatient,
    group: group ? { id: group.id, name: group.name } : null,
    surveys: { story, revision },
  };
}


}
