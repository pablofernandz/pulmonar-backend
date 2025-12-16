import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';


@Injectable()
export class NotificationsService {
  constructor(private readonly ds: DataSource) {}

  async getFor(user: { id: number; roles: Record<string, boolean> }) {
    if (user.roles?.coordinator) return this.forCoordinator();
    if (user.roles?.revisor) return this.forRevisor(user.id);
    if (user.roles?.patient) return this.forPatient(user.id);
    return { notifications: [], counters: {} };
  }


  private async forPatient(idUser: number) {
    const [upcoming, upcomingCount, recentEval, overdue] = await Promise.all([
      this.nextAppointmentsFor({ patientId: idUser, limit: 5 }),
      this.upcomingAppointmentsCount({ patientId: idUser }),
      this.recentEvaluations({ patientId: idUser, limit: 5 }),
      this.overdueAppointmentsFor({ patientId: idUser, limit: 5 }),
    ]);

    return {
      counters: {
        pendingAppointments: upcomingCount,
        recentEvaluations: recentEval.length,
        overdueAppointments: overdue.length,
      },
      notifications: [
        ...(upcoming.length ? [{ type: 'upcoming_appointments', items: upcoming }] : []),
        ...(overdue.length ? [{ type: 'overdue_appointments', items: overdue }] : []),
        ...(recentEval.length ? [{ type: 'recent_evaluations', items: recentEval }] : []),
      ],
    };
  }


  private async forRevisor(idUser: number) {
    const [upcoming, upcomingCount, recentEval, overdue, lackingHistory] = await Promise.all([
      this.nextAppointmentsFor({ revisorId: idUser, limit: 5 }),
      this.upcomingAppointmentsCount({ revisorId: idUser }),
      this.recentEvaluations({ revisorId: idUser, limit: 5 }),
      this.overdueAppointmentsFor({ revisorId: idUser, limit: 5 }),
      this.patientsWithoutHistoryInMyGroups(idUser),
    ]);

    return {
      counters: {
        pendingAppointments: upcomingCount,
        patientsWithoutHistory: lackingHistory,
        recentEvaluations: recentEval.length,
        overdueAppointments: overdue.length,
      },
      notifications: [
        ...(lackingHistory > 0
          ? [{ type: 'patients_without_history', count: lackingHistory }]
          : []),
        ...(upcoming.length ? [{ type: 'upcoming_appointments', items: upcoming }] : []),
        ...(overdue.length ? [{ type: 'overdue_appointments', items: overdue }] : []),
        ...(recentEval.length ? [{ type: 'recent_evaluations', items: recentEval }] : []),
      ],
    };
  }


  private async forCoordinator() {
    const [upcoming, upcomingCount, lastEvals, lackingHistory] = await Promise.all([
      this.nextAppointmentsFor({ limit: 5 }),
      this.upcomingAppointmentsCount({}),
      this.recentEvaluations({ limit: 5 }),
      this.patientsWithoutHistoryGlobal(),
    ]);

    return {
      counters: {
        pendingAppointments: upcomingCount,
        patientsWithoutHistory: lackingHistory,
        recentEvaluations: lastEvals.length,
      },
      notifications: [
        ...(upcoming.length ? [{ type: 'upcoming_appointments', items: upcoming }] : []),
        ...(lastEvals.length ? [{ type: 'recent_evaluations', items: lastEvals }] : []),
        ...(lackingHistory > 0
          ? [{ type: 'patients_without_history_system', count: lackingHistory }]
          : []),
      ],
    };
  }

  private async nextAppointmentsFor(opts: {
    patientId?: number;
    revisorId?: number;
    limit?: number;
  }) {
    const limit = Math.max(1, Math.min(opts.limit ?? 5, 20));
    const where: string[] = ['a.date >= NOW()'];
    const params: any[] = [];
    if (opts.patientId) {
      where.push('a.patient = ?');
      params.push(opts.patientId);
    }
    if (opts.revisorId) {
      where.push('a.revisor = ?');
      params.push(opts.revisorId);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.ds.query(
      `SELECT a.id, a.date, sa.name AS status, a.type, a.comments, a.patient, a.revisor
         FROM appointment a
         INNER JOIN statusappointment sa ON sa.id = a.status
         ${whereSql}
         ORDER BY a.date ASC
         LIMIT ${limit}`,
      params,
    );
  }

  private async overdueAppointmentsFor(opts: {
    patientId?: number;
    revisorId?: number;
    limit?: number;
  }) {
    const limit = Math.max(1, Math.min(opts.limit ?? 5, 20));
    const where: string[] = ['a.date < NOW()'];
    const params: any[] = [];
    if (opts.patientId) {
      where.push('a.patient = ?');
      params.push(opts.patientId);
    }
    if (opts.revisorId) {
      where.push('a.revisor = ?');
      params.push(opts.revisorId);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.ds.query(
      `SELECT a.id, a.date, sa.name AS status, a.type, a.comments, a.patient, a.revisor
         FROM appointment a
         INNER JOIN statusappointment sa ON sa.id = a.status
         ${whereSql}
         ORDER BY a.date DESC
         LIMIT ${limit}`,
      params,
    );
  }

  private async upcomingAppointmentsCount(opts: { patientId?: number; revisorId?: number }) {
    const where: string[] = ['a.date >= NOW()'];
    const params: any[] = [];
    if (opts.patientId) { where.push('a.patient = ?'); params.push(opts.patientId); }
    if (opts.revisorId) { where.push('a.revisor = ?'); params.push(opts.revisorId); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const rows = await this.ds.query(
      `SELECT COUNT(*) AS c
         FROM appointment a
         ${whereSql}`,
      params,
    );
    return Number(rows?.[0]?.c ?? 0);
  }

  private async recentEvaluations(opts: {
    patientId?: number;
    revisorId?: number;
    limit?: number;
  }) {
    const limit = Math.max(1, Math.min(opts.limit ?? 5, 20));
    const where: string[] = ['e.deleted = 0'];
    const params: any[] = [];
    if (opts.patientId) {
      where.push('e.idPatient = ?');
      params.push(opts.patientId);
    }
    if (opts.revisorId) {
      where.push('e.idRevisor = ?');
      params.push(opts.revisorId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    return this.ds.query(
      `SELECT e.id, e.date, e.idPatient, e.idRevisor, e.idSurvey,
              s.name AS surveyName, s.type AS surveyType
         FROM evaluation e
         INNER JOIN survey s ON s.id = e.idSurvey
         ${whereSql}
         ORDER BY e.date DESC
         LIMIT ${limit}`,
      params,
    );
  }

  private async patientsWithoutHistoryInMyGroups(idRevisor: number) {
    const totalPatientsRows = await this.ds.query(
      `SELECT COUNT(DISTINCT gp.idPatient) AS c
         FROM grouprevisor gr
         INNER JOIN grouppatient gp ON gp.idGroup = gr.idGroup AND gp.deleted = 0
        WHERE gr.deleted = 0
          AND gr.idRevisor = ?`,
      [idRevisor],
    );
    const withHistoryRows = await this.ds.query(
      `SELECT COUNT(DISTINCT gp.idPatient) AS c
         FROM grouprevisor gr
         INNER JOIN grouppatient gp ON gp.idGroup = gr.idGroup AND gp.deleted = 0
         INNER JOIN evaluation e ON e.idPatient = gp.idPatient AND e.deleted = 0
         INNER JOIN survey s ON s.id = e.idSurvey AND s.type = 0
        WHERE gr.deleted = 0
          AND gr.idRevisor = ?`,
      [idRevisor],
    );
    const total = Number(totalPatientsRows?.[0]?.c ?? 0);
    const withHist = Number(withHistoryRows?.[0]?.c ?? 0);
    return Math.max(0, total - withHist);
  }

  private async patientsWithoutHistoryGlobal() {
    const totalRows = await this.ds.query(
      `SELECT COUNT(*) AS c FROM patient p WHERE p.deleted = 0`,
    );
    const withHistoryRows = await this.ds.query(
      `SELECT COUNT(DISTINCT e.idPatient) AS c
         FROM evaluation e
         INNER JOIN survey s ON s.id = e.idSurvey AND s.type = 0
        WHERE e.deleted = 0`,
    );
    return Math.max(0, Number(totalRows?.[0]?.c ?? 0) - Number(withHistoryRows?.[0]?.c ?? 0));
  }
}
