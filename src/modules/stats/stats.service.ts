import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

type ByRevisor = { idRevisor: number; count: number };
type IndexAgg = { idIndex: number; name: string | null; n: number; avg: number; min: number; max: number };

type SurveySummary = {
  totalEvaluations: number;
  uniquePatients: number;
  completed: number;
  byRevisor: ByRevisor[];
  indices: IndexAgg[];
};

type GroupSummary = {
  activePatients: number;
  totalEvaluations: number;
  bySurvey: Array<{ idSurvey: number; count: number; completed: number }>;
  byRevisor: ByRevisor[];
};

function parseRange(from?: string, to?: string) {
  const start = from ? new Date(from) : undefined;
  const end = to ? new Date(to) : undefined;
  if (start && isNaN(start.getTime())) throw new BadRequestException('from inválido');
  if (end && isNaN(end.getTime())) throw new BadRequestException('to inválido');
  return { start, end };
}


function historicalGroupJoinSQL(groupId?: number) {
  const filterGroup = groupId ? ' AND gp.idGroup = ? ' : '';
  const join = `
    LEFT JOIN grouppatient gp
      ON gp.idPatient = e.idPatient
     AND gp.date_insert = (
          SELECT MAX(gp2.date_insert)
          FROM grouppatient gp2
          WHERE gp2.idPatient = e.idPatient
            AND gp2.date_insert <= e.date
        )
     AND (gp.deleted = 0 OR (gp.deleted = 1 AND gp.date_update > e.date))
     ${filterGroup}
    LEFT JOIN \`group\` g ON g.id = gp.idGroup
  `;
  const params: any[] = [];
  if (groupId) params.push(groupId);
  return { join, params };
}

@Injectable()
export class StatsService {
  constructor(private readonly ds: DataSource) {}

  async surveySummary(
    surveyId: number,
    range: { from?: string; to?: string; groupId?: number },
  ): Promise<SurveySummary> {
    const { start, end } = parseRange(range.from, range.to);

    const whereParts: string[] = ['e.deleted = 0', 'e.idSurvey = ?'];
    const paramsWhere: any[] = [surveyId];
    if (start) { whereParts.push('e.`date` >= ?'); paramsWhere.push(start); }
    if (end)   { whereParts.push('e.`date` <= ?'); paramsWhere.push(end); }
    const whereDate = whereParts.join(' AND ');

    const { join, params: paramsJoin } = historicalGroupJoinSQL(range.groupId);

    const [totals] = await this.ds.query(
      `
      SELECT COUNT(*) AS totalEvaluations,
             COUNT(DISTINCT e.idPatient) AS uniquePatients
      FROM evaluation e
      ${join}
      WHERE ${whereDate}
      `,
      [...paramsJoin, ...paramsWhere],
    );

    const byRevisor = await this.ds.query(
      `
      SELECT e.idRevisor AS idRevisor, COUNT(*) AS count
      FROM evaluation e
      ${join}
      WHERE ${whereDate}
      GROUP BY e.idRevisor
      ORDER BY count DESC
      `,
      [...paramsJoin, ...paramsWhere],
    );

    const [{ totalQuestions = 0 } = {}] = await this.ds.query(
      `
      SELECT COUNT(DISTINCT sq.idQuestion) AS totalQuestions
      FROM surveysection ss
      INNER JOIN sectionquestion sq ON sq.idSection = ss.idSection
      INNER JOIN question q ON q.id = sq.idQuestion AND q.deleted = 0
      WHERE ss.idSurvey = ?
      `,
      [surveyId],
    );

    let completed = 0;
    if (Number(totalQuestions) > 0) {
      const completedParams = [
        ...paramsJoin,
        surveyId,                
        ...paramsWhere,          
        Number(totalQuestions),  
      ];

      const [{ completed: comp = 0 } = {}] = await this.ds.query(
        `
        SELECT COUNT(*) AS completed
        FROM (
          SELECT e.id
          FROM evaluation e
          ${join}
          INNER JOIN evaluation_question a
            ON a.idEvaluation = e.id AND a.deleted = 0
          -- mapear respuestas a preguntas del survey
          INNER JOIN sectionquestion sq ON sq.idQuestion = a.idQuestion
          INNER JOIN surveysection ss   ON ss.idSection  = sq.idSection AND ss.idSurvey = ?
          WHERE ${whereDate}
          GROUP BY e.id
          HAVING COUNT(DISTINCT a.idQuestion) >= ?
        ) t
        `,
        completedParams,
      );
      completed = Number(comp);
    }

    const indicesRaw = await this.ds.query(
      `
      SELECT
        ei.idIndex    AS idIndex,
        i.name        AS name,
        COUNT(*)      AS n,
        AVG(ei.value) AS avg,
        MIN(ei.value) AS min,
        MAX(ei.value) AS max
      FROM evaluation_index ei
      INNER JOIN evaluation e ON e.id = ei.idEvaluation
      INNER JOIN surveyindex si ON si.idIndex = ei.idIndex AND si.idSurvey = e.idSurvey
      INNER JOIN \`index\` i ON i.id = ei.idIndex
      ${join}
      WHERE ${whereDate}
      GROUP BY ei.idIndex, i.name
      ORDER BY i.name ASC
      `,
      [...paramsJoin, ...paramsWhere],
    );

    return {
      totalEvaluations: Number(totals?.totalEvaluations ?? 0),
      uniquePatients: Number(totals?.uniquePatients ?? 0),
      completed,
      byRevisor: (byRevisor as any[]).map((r) => ({
        idRevisor: Number(r.idRevisor),
        count: Number(r.count),
      })),
      indices: (indicesRaw as any[]).map((r) => ({
        idIndex: Number(r.idIndex),
        name: r.name ?? null,
        n: Number(r.n),
        avg: r.avg != null ? Number(r.avg) : NaN,
        min: r.min != null ? Number(r.min) : NaN,
        max: r.max != null ? Number(r.max) : NaN,
      })),
    };
  }

  async groupSummary(groupId: number, range: { from?: string; to?: string }): Promise<GroupSummary> {
    const { start, end } = parseRange(range.from, range.to);

    const [{ activePatients = 0 } = {}] = await this.ds.query(
      `
      SELECT COUNT(DISTINCT gp.idPatient) AS activePatients
      FROM grouppatient gp
      WHERE gp.idGroup = ? AND gp.deleted = 0
      `,
      [groupId],
    );

    const whereParts: string[] = ['e.deleted = 0'];
    const paramsWhere: any[] = [];
    if (start) { whereParts.push('e.\`date\` >= ?'); paramsWhere.push(start); }
    if (end)   { whereParts.push('e.\`date\` <= ?'); paramsWhere.push(end); }
    const whereSql = whereParts.join(' AND ');

    const { join, params: paramsJoin } = historicalGroupJoinSQL(groupId);

    const [tot] = await this.ds.query(
      `
      SELECT COUNT(*) AS totalEvaluations
      FROM evaluation e
      ${join}
      WHERE ${whereSql}
      `,
      [...paramsJoin, ...paramsWhere],
    );

    const byRevisor = await this.ds.query(
      `
      SELECT e.idRevisor AS idRevisor, COUNT(*) AS count
      FROM evaluation e
      ${join}
      WHERE ${whereSql}
      GROUP BY e.idRevisor
      ORDER BY count DESC
      `,
      [...paramsJoin, ...paramsWhere],
    );

    const bySurvey = await this.ds.query(
      `
      SELECT t.idSurvey,
             COUNT(*) AS count,
             SUM(CASE WHEN t.answeredRequired >= t.requiredCount THEN 1 ELSE 0 END) AS completed
      FROM (
        SELECT e.id, e.idSurvey,
               COUNT(DISTINCT a.idQuestion) AS answeredRequired,
               rc.requiredCount
        FROM evaluation e
        ${join}
        LEFT JOIN evaluation_question a
          ON a.idEvaluation = e.id AND a.deleted = 0
        -- total de preguntas por survey
        LEFT JOIN (
          SELECT ss.idSurvey, COUNT(DISTINCT sq.idQuestion) AS requiredCount
          FROM surveysection ss
          INNER JOIN sectionquestion sq ON sq.idSection = ss.idSection
          INNER JOIN question q2 ON q2.id = sq.idQuestion AND q2.deleted = 0
          GROUP BY ss.idSurvey
        ) rc ON rc.idSurvey = e.idSurvey
        WHERE ${whereSql}
        GROUP BY e.id
      ) t
      GROUP BY t.idSurvey
      ORDER BY t.idSurvey ASC
      `,
      [...paramsJoin, ...paramsWhere],
    );

    return {
      activePatients: Number(activePatients ?? 0),
      totalEvaluations: Number(tot?.totalEvaluations ?? 0),
      bySurvey: (bySurvey as any[]).map((r) => ({
        idSurvey: Number(r.idSurvey),
        count: Number(r.count),
        completed: Number(r.completed ?? 0),
      })),
      byRevisor: (byRevisor as any[]).map((r) => ({
        idRevisor: Number(r.idRevisor),
        count: Number(r.count),
      })),
    };
  }

  async listEvaluations(q: {
    from?: string; to?: string; groupId?: number; revisor?: number; patient?: number; survey?: number;
    page?: number; limit?: number;
  }) {
    const { start, end } = parseRange(q.from, q.to);

    const whereParts: string[] = ['e.deleted = 0'];
    const paramsWhere: any[] = [];
    if (start)   { whereParts.push('e.\`date\` >= ?'); paramsWhere.push(start); }
    if (end)     { whereParts.push('e.\`date\` <= ?'); paramsWhere.push(end); }
    if (q.revisor) { whereParts.push('e.idRevisor = ?'); paramsWhere.push(q.revisor); }
    if (q.patient) { whereParts.push('e.idPatient = ?'); paramsWhere.push(q.patient); }
    if (q.survey)  { whereParts.push('e.idSurvey  = ?'); paramsWhere.push(q.survey); }
    const whereSql = whereParts.join(' AND ');

    const { join, params: paramsJoin } = q.groupId
      ? historicalGroupJoinSQL(q.groupId)
      : { join: '', params: [] as any[] };

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const offset = (page - 1) * limit;

    const items = await this.ds.query(
      `
      SELECT e.id, e.idPatient, e.idSurvey, e.idRevisor, e.date
      FROM evaluation e
      ${join}
      WHERE ${whereSql}
      ORDER BY e.date DESC, e.id DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      [...paramsJoin, ...paramsWhere],
    );

    const [{ total = 0 } = {}] = await this.ds.query(
      `
      SELECT COUNT(*) AS total
      FROM evaluation e
      ${join}
      WHERE ${whereSql}
      `,
      [...paramsJoin, ...paramsWhere],
    );

    return { page, limit, total: Number(total), items };
  }

  async getGlobal(q: {
    from?: string; to?: string; groupId?: number; indexId?: number; indexName?: string;
    page?: number; limit?: number;
  }) {
    const { start, end } = parseRange(q.from, q.to);

    const whereParts: string[] = ['e.deleted = 0'];
    const paramsWhere: any[] = [];
    if (q.indexId)  { whereParts.push('ei.idIndex = ?'); paramsWhere.push(q.indexId); }
    if (!q.indexId && q.indexName) { whereParts.push('i.name = ?'); paramsWhere.push(q.indexName); }
    if (start) { whereParts.push('e.\`date\` >= ?'); paramsWhere.push(start); }
    if (end)   { whereParts.push('e.\`date\` <= ?'); paramsWhere.push(end); }
    const whereSql = whereParts.join(' AND ');

    const { join, params: paramsJoin } = historicalGroupJoinSQL(q.groupId);

    const page = q.page ?? 1;
    const limit = q.limit ?? 5000;
    const offset = (page - 1) * limit;

    const sqlData = `
      SELECT
        p.id                                   AS idPatient,
        CONCAT_WS(' ', p.name, p.last_name_1)  AS patientName,
        e.id                                   AS idEvaluation,
        DATE_FORMAT(e.date, '%Y-%m-%d %H:%i:%s') AS date,
        i.id                                   AS indexId,
        i.name                                 AS indexName,
        ei.value                               AS value,
        g.id                                   AS groupId,
        g.name                                 AS groupName,
        r.id                                   AS revisorId,
        CONCAT_WS(' ', r.name, r.last_name_1)  AS revisorName,
        s.id                                   AS surveyId,
        s.name                                 AS surveyName
      FROM evaluation_index ei
      INNER JOIN evaluation e ON e.id = ei.idEvaluation
      INNER JOIN \`index\` i  ON i.id = ei.idIndex
      INNER JOIN \`user\` p   ON p.id = e.idPatient
      LEFT  JOIN \`user\` r   ON r.id = e.idRevisor
      LEFT  JOIN survey s     ON s.id = e.idSurvey
      ${join}
      WHERE ${whereSql}
      ORDER BY e.date ASC, e.id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const dataRows = await this.ds.query(sqlData, [...paramsJoin, ...paramsWhere]);

    const sqlCount = `
      SELECT COUNT(*) AS total
      FROM evaluation_index ei
      INNER JOIN evaluation e ON e.id = ei.idEvaluation
      INNER JOIN \`index\` i  ON i.id = ei.idIndex
      INNER JOIN \`user\` p   ON p.id = e.idPatient
      LEFT  JOIN \`user\` r   ON r.id = e.idRevisor
      LEFT  JOIN survey s     ON s.id = e.idSurvey
      ${join}
      WHERE ${whereSql}
    `;
    const [{ total = 0 } = {}] = await this.ds.query(sqlCount, [...paramsJoin, ...paramsWhere]);

    const [seriesGroups, availableIndices] = await Promise.all([
      this.ds.query(`
        SELECT g.id AS groupId, g.name AS groupName
        FROM \`group\` g
        ORDER BY g.name ASC
      `),
      this.ds.query(`
        SELECT i.id AS indexId, i.name AS indexName
        FROM \`index\` i
        ORDER BY i.name ASC
      `),
    ]);

    return {
      data: dataRows,
      parametros: {
        seriesGroups,
        availableIndices,
        range: { from: q.from, to: q.to },
      },
      paging: {
        page,
        limit,
        totalRows: Number(total ?? 0),
        hasMore: offset + (dataRows?.length ?? 0) < Number(total ?? 0),
      },
    };
  }
}
