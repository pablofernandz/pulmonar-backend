import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  FindOptionsWhere,
  Not,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { StatusAppointment } from './statusappointment.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Revisor } from '../revisores/revisor.entity';
import { CreateAppointmentDto } from './dtos/create-appointment.dto';
import { UpdateAppointmentDto } from './dtos/update-appointment.dto';
import { ListAppointmentsDto } from './dtos/list-appointments.dto';

function cap(s: string | undefined | null, n: number) {
  if (s == null) return s as any;
  const t = s.trim();
  return t.length > n ? t.slice(0, n) : t;
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private readonly repo: Repository<Appointment>,
    @InjectRepository(StatusAppointment) private readonly statuses: Repository<StatusAppointment>,
    @InjectRepository(Paciente) private readonly patients: Repository<Paciente>,
    @InjectRepository(Revisor) private readonly revisores: Repository<Revisor>,
    private readonly ds: DataSource,
  ) {}


  async listStatuses() {
    return this.statuses.find({ select: ['id', 'name'], order: { id: 'ASC' } });
  }

  // -------------------------- Funciones Auxiliares -------------------------- 

  private async ensureRefs(dto: { patientId: number; revisorId: number; statusId: number }) {
    const [pat, rev, st] = await Promise.all([
      this.patients.findOne({ where: { id: dto.patientId } }),
      this.revisores.findOne({ where: { id: dto.revisorId } }),
      this.statuses.findOne({ where: { id: dto.statusId } }),
    ]);
    if (!pat || pat.deleted === 1) throw new BadRequestException('Paciente no válido/activo');
    if (!rev || rev.deleted === 1) throw new BadRequestException('Revisor no válido/activo');
    if (!st) throw new BadRequestException('Estado no válido');
    return { pat, rev, st };
  }

  private async shareActiveGroup(patientId: number, revisorId: number) {
    const [row] = await this.ds.query(
      `SELECT 1 AS ok
         FROM grouprevisor gr
         INNER JOIN grouppatient gp ON gp.idGroup = gr.idGroup AND gp.deleted = 0
        WHERE gr.deleted = 0 AND gr.idRevisor = ? AND gp.idPatient = ?
        LIMIT 1`,
      [revisorId, patientId],
    );
    return !!row;
  }

  private async guardRevisorScope(
    user: { id: number; roles: Record<string, boolean> },
    targetRevisorId: number,
  ) {
    if (user?.roles?.coordinator) return;
    if (!user?.roles?.revisor) throw new ForbiddenException();
    if (user.id !== targetRevisorId) throw new ForbiddenException('Solo puedes gestionar tus citas');
  }

  // ---------------------------- CRUD ---------------------------

  async create(user: { id: number; roles: Record<string, boolean> }, dto: CreateAppointmentDto) {
    await this.guardRevisorScope(user, dto.revisorId);
    const { pat, rev, st } = await this.ensureRefs(dto);

    if (!(await this.shareActiveGroup(pat.id, rev.id))) {
      throw new ForbiddenException('Paciente y revisor no comparten grupo activo');
    }

    const date = new Date(dto.date);
    if (isNaN(date.getTime())) throw new BadRequestException('date inválida');

    const clash = await this.repo.findOne({
      where: [
        { revisor: { id: rev.id }, date },
        { patient: { id: pat.id }, date },
      ] as any,
    });
    if (clash) throw new ConflictException('Ya existe una cita en ese momento');

    const a = this.repo.create({
      date,
      status: st,
      comments: cap(dto.comments, 400) ?? null,
      type: dto.type,
      patient: pat,
      revisor: rev,
    });
    return this.repo.save(a);
  }

  async update(
    user: { id: number; roles: Record<string, boolean> },
    id: number,
    dto: UpdateAppointmentDto,
  ) {
    const ap = await this.repo.findOne({ where: { id } });
    if (!ap) throw new NotFoundException('Cita no encontrada');

    await this.guardRevisorScope(user, dto.revisorId ?? ap.revisor.id);

    if (dto.patientId || dto.revisorId || dto.statusId) {
      const refs = await this.ensureRefs({
        patientId: dto.patientId ?? ap.patient.id,
        revisorId: dto.revisorId ?? ap.revisor.id,
        statusId: dto.statusId ?? ap.status.id,
      });

      if (!(await this.shareActiveGroup(refs.pat.id, refs.rev.id))) {
        throw new ForbiddenException('Paciente y revisor no comparten grupo activo');
      }

      ap.patient = refs.pat;
      ap.revisor = refs.rev;
      ap.status = refs.st;
    }

    if (dto.date) {
      const date = new Date(dto.date);
      if (isNaN(date.getTime())) throw new BadRequestException('date inválida');
      const clash = await this.repo.findOne({
        where: [
          { id: Not(id), revisor: { id: ap.revisor.id }, date },
          { id: Not(id), patient: { id: ap.patient.id }, date },
        ] as any,
      });
      if (clash) throw new ConflictException('Ya existe una cita en ese momento');
      ap.date = date;
    }

    if (dto.type !== undefined) ap.type = dto.type;
    if (dto.comments !== undefined) ap.comments = cap(dto.comments, 400) ?? null;

    return this.repo.save(ap);
  }

  async findOne(user: { id: number; roles: Record<string, boolean> }, id: number) {
    const ap = await this.repo.findOne({ where: { id } });
    if (!ap) throw new NotFoundException('Cita no encontrada');

    if (user?.roles?.coordinator) return ap;

    if (user?.roles?.revisor) {
      if (ap.revisor.id !== user.id) throw new ForbiddenException();
      return ap;
    }

    if (user?.roles?.patient) {
      if (ap.patient.id !== user.id) throw new ForbiddenException();
      return ap;
    }

    throw new ForbiddenException();
  }

  async list(user: { id: number; roles: Record<string, boolean> }, q: ListAppointmentsDto) {
    const where: FindOptionsWhere<Appointment> = {};

    if (q.patient) where.patient = { id: q.patient } as any;
    if (q.revisor) where.revisor = { id: q.revisor } as any;
    if (q.status) where.status = { id: q.status } as any;
    if (q.type !== undefined) where.type = q.type;

    if (q.from && q.to) where.date = Between(new Date(q.from), new Date(q.to));
    else if (q.from) where.date = MoreThanOrEqual(new Date(q.from));
    else if (q.to) where.date = LessThanOrEqual(new Date(q.to));

    if (user?.roles?.revisor && !user?.roles?.coordinator) {
      where.revisor = { id: user.id } as any;
    } else if (user?.roles?.patient && !user?.roles?.coordinator && !user?.roles?.revisor) {
      where.patient = { id: user.id } as any;
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { date: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { page, limit, total, items };
  }
}
