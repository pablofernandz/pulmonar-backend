import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './group.entity';
import { GroupPatient } from './grouppatient.entity';
import { GroupRevisor } from './grouprevisor.entity';
import { CreateGroupDto } from './dtos/create-group.dto';
import { AddPatientDto } from './dtos/add-patient.dto';
import { AddRevisorDto } from './dtos/add-revisor.dto';
import { UpdateGroupDto } from './dtos/update-group.dto';
import { User } from '../users/user.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Revisor } from '../revisores/revisor.entity';


// --------------------- Funciones auxiliares -----------------------

function cap(s: string | undefined | null, n: number) {
  if (s == null) return s as any;
  const t = s.trim();
  return t.length > n ? t.slice(0, n) : t;
}

function mapDuplicateName(e: any): never {
  const code = e?.code || e?.errno;
  const msg: string = String(e?.sqlMessage || e?.message || e);
  if (code === 'ER_DUP_ENTRY' || msg.includes('Duplicate entry')) {
    throw new ConflictException('Ya existe un grupo con ese nombre');
  }
  throw e;
}



@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private groups: Repository<Group>,
    @InjectRepository(GroupPatient) private gp: Repository<GroupPatient>,
    @InjectRepository(GroupRevisor) private gr: Repository<GroupRevisor>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Paciente) private patients: Repository<Paciente>,
    @InjectRepository(Revisor) private revisores: Repository<Revisor>,
  ) {}

  async create(dto: CreateGroupDto) {
    const name = cap(dto.name, 45);
    if (!name) throw new BadRequestException('name requerido');

    if (dto.story === undefined || dto.story === null) {
      throw new BadRequestException('story requerido');
    }
    if (dto.revision === undefined || dto.revision === null) {
      throw new BadRequestException('revision requerido');
    }

    const [okStory, okRevision] = await Promise.all([
      this.existsSurvey(dto.story),
      this.existsSurvey(dto.revision),
    ]);
    if (!okStory) throw new BadRequestException(`Encuesta (story) inexistente: ${dto.story}`);
    if (!okRevision) throw new BadRequestException(`Encuesta (revision) inexistente: ${dto.revision}`);

    const g = this.groups.create({ name, story: dto.story, revision: dto.revision });
    try {
      return await this.groups.save(g);
    } catch (e) {
      mapDuplicateName(e);
    }
  }

  async addPatient(dto: AddPatientDto) {
    const [g, u] = await Promise.all([
      this.groups.findOne({ where: { id: dto.idGroup } }),
      this.users.findOne({ where: { id: dto.idPaciente } }),
    ]);
    if (!g) throw new NotFoundException('Grupo no encontrado');
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const pat = await this.patients.findOne({ where: { id: dto.idPaciente } });
    if (!pat || pat.deleted === 1) {
      throw new ConflictException('El usuario no tiene rol de paciente activo');
    }

    const existing = await this.gp.findOne({ where: { idGroup: g.id, idPatient: u.id } });
    if (!existing) {
      await this.gp.insert({ idGroup: g.id, idPatient: u.id, deleted: 0 });
    } else if (existing.deleted === 1) {
      await this.gp.update({ idGroup: g.id, idPatient: u.id }, { deleted: 0 });
    }
    return { ok: true };
  }


  async addRevisor(dto: AddRevisorDto) {
    const [g, u] = await Promise.all([
      this.groups.findOne({ where: { id: dto.idGroup } }),
      this.users.findOne({ where: { id: dto.idRevisor } }),
    ]);
    if (!g) throw new NotFoundException('Grupo no encontrado');
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const rev = await this.revisores.findOne({ where: { id: dto.idRevisor } });
    if (!rev || rev.deleted === 1) {
      throw new ConflictException('El usuario no tiene rol de revisor activo');
    }

    const existing = await this.gr.findOne({ where: { idGroup: g.id, idRevisor: u.id } });
    if (!existing) {
      await this.gr.insert({ idGroup: g.id, idRevisor: u.id, deleted: 0 });
    } else if (existing.deleted === 1) {
      await this.gr.update({ idGroup: g.id, idRevisor: u.id }, { deleted: 0 });
    }
    return { ok: true };
  }


async listGroupsFor(
  user: { id: number; roles: Record<string, boolean> },
  qRaw?: string,
) {
  const q = qRaw?.trim();
  const hasFilter = !!q;
  let whereClause = '';
  const extraParams: any[] = [];

  if (hasFilter) {
    const like = `%${q}%`;
    const maybeId = Number(q);
    const isNumeric = !Number.isNaN(maybeId) && Number.isFinite(maybeId);

    whereClause =
      'WHERE (g.`name` LIKE ? OR s1.`name` LIKE ? OR s2.`name` LIKE ?' +
      (isNumeric ? ' OR g.`id` = ?' : '') +
      ')';

    extraParams.push(like, like, like);
    if (isNumeric) extraParams.push(maybeId);
  }

  if (user.roles?.coordinator) {
    return this.groups.query(
      `SELECT
         g.\`id\`,
         g.\`name\`,
         g.\`story\`,
         g.\`revision\`,
         s1.\`name\` AS storyName,
         s2.\`name\` AS revisionName
       FROM \`group\` g
       LEFT JOIN \`survey\` s1 ON s1.\`id\` = g.\`story\`   AND s1.\`deleted\` = 0
       LEFT JOIN \`survey\` s2 ON s2.\`id\` = g.\`revision\` AND s2.\`deleted\` = 0
       ${whereClause}
       ORDER BY g.\`name\` ASC`,
      extraParams,
    );
  }

  if (user.roles?.revisor) {
    return this.groups.query(
      `SELECT
         g.\`id\`,
         g.\`name\`,
         g.\`story\`,
         g.\`revision\`,
         s1.\`name\` AS storyName,
         s2.\`name\` AS revisionName
       FROM \`group\` g
       INNER JOIN \`grouprevisor\` gr
               ON gr.\`idGroup\` = g.\`id\`
              AND gr.\`deleted\` = 0
              AND gr.\`idRevisor\` = ?
       LEFT JOIN \`survey\` s1 ON s1.\`id\` = g.\`story\`   AND s1.\`deleted\` = 0
       LEFT JOIN \`survey\` s2 ON s2.\`id\` = g.\`revision\` AND s2.\`deleted\` = 0
       ${whereClause}
       ORDER BY g.\`name\` ASC`,
      [user.id, ...extraParams],
    );
  }

  throw new ForbiddenException();
}


  async membersFor(user: { id: number; roles: Record<string, boolean> }, idGroup: number) {
    const g = await this.groups.findOne({ where: { id: idGroup } });
    if (!g) throw new NotFoundException('Grupo no encontrado');

    if (!user?.roles?.coordinator) {
      if (!user?.roles?.revisor) throw new ForbiddenException();
      const belongs = await this.gr.findOne({
        where: { idGroup, idRevisor: user.id, deleted: 0 },
      });
      if (!belongs) throw new ForbiddenException();
    }

    const pacientes = await this.users
      .createQueryBuilder('u')
      .innerJoin(GroupPatient, 'gp', 'gp.idPatient = u.id AND gp.deleted = 0 AND gp.idGroup = :idg', { idg: idGroup })
      .select([
        'u.id AS id',
        'u.dni AS nif',
        'u.name AS nombre',
        "CONCAT(IFNULL(u.last_name_1,''), CASE WHEN u.last_name_2 IS NULL OR u.last_name_2='' THEN '' ELSE ' ' END, IFNULL(u.last_name_2,'')) AS apellidos",
      ])
      .orderBy('u.name', 'ASC')
      .getRawMany();

    const revisores = await this.users
      .createQueryBuilder('u')
      .innerJoin(GroupRevisor, 'gr', 'gr.idRevisor = u.id AND gr.deleted = 0 AND gr.idGroup = :idg', { idg: idGroup })
      .select([
        'u.id AS id',
        'u.dni AS nif',
        'u.name AS nombre',
        "CONCAT(IFNULL(u.last_name_1,''), CASE WHEN u.last_name_2 IS NULL OR u.last_name_2='' THEN '' ELSE ' ' END, IFNULL(u.last_name_2,'')) AS apellidos",
      ])
      .orderBy('u.name', 'ASC')
      .getRawMany();

    return { group: { id: g.id, name: g.name }, pacientes, revisores };
  }

  async removePatient(idGroup: number, idPaciente: number) {
    const row = await this.gp.findOne({ where: { idGroup, idPatient: idPaciente } });
    if (!row) {
      throw new NotFoundException('El paciente no pertenece al grupo');
    }
    if (row.deleted === 1) {
      return { ok: true, changed: false, reason: 'already_removed' };
    }
    await this.gp.update({ idGroup, idPatient: idPaciente }, { deleted: 1 });
    return { ok: true, changed: true };
  }

  async removeRevisor(idGroup: number, idRevisor: number) {
    const row = await this.gr.findOne({ where: { idGroup, idRevisor } });
    if (!row) {
      throw new NotFoundException('El revisor no pertenece al grupo');
    }
    if (row.deleted === 1) {
      return { ok: true, changed: false, reason: 'already_removed' };
    }
    await this.gr.update({ idGroup, idRevisor }, { deleted: 1 });
    return { ok: true, changed: true };
  }


  async update(id: number, dto: UpdateGroupDto) {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const patch: any = {};

    if (dto.name !== undefined) {
      const name = cap(dto.name, 45);
      if (!name) throw new BadRequestException('name requerido');
      patch.name = name;
    }

    if (dto.story !== undefined) {
      if (dto.story === null) {
        patch.story = null;
      } else {
        const ok = await this.existsSurvey(dto.story);
        if (!ok) throw new BadRequestException(`Encuesta (story) inexistente: ${dto.story}`);
        patch.story = dto.story;
      }
    }

    if (dto.revision !== undefined) {
      if (dto.revision === null) {
        patch.revision = null;
      } else {
        const ok = await this.existsSurvey(dto.revision);
        if (!ok) throw new BadRequestException(`Encuesta (revision) inexistente: ${dto.revision}`);
        patch.revision = dto.revision;
      }
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, id, unchanged: true };
    }

    try {
      await this.groups.update({ id }, patch);
    } catch (e) {
      mapDuplicateName(e);
    }

const [row] = await this.groups.query(
  `SELECT
     g.\`id\`,
     g.\`name\`,
     g.\`story\`,
     g.\`revision\`,
     s1.\`name\` AS storyName,
     s2.\`name\` AS revisionName
   FROM \`group\` g
   LEFT JOIN \`survey\` s1 ON s1.\`id\` = g.\`story\`   AND s1.\`deleted\` = 0
   LEFT JOIN \`survey\` s2 ON s2.\`id\` = g.\`revision\` AND s2.\`deleted\` = 0
   WHERE g.\`id\` = ?`,
  [id],
);
return row ?? { ok: true, id };
}


  private async existsSurvey(id: number) {
  const rows = await this.groups.query(
    'SELECT 1 FROM `survey` WHERE id = ? AND deleted = 0 LIMIT 1',
    [id],
  );
  return !!rows.length;
}

}
