import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Survey } from './survey.entity';
import { Section } from './section.entity';
import { Question } from './question.entity';
import { SurveySection } from './surveysection.entity';
import { SectionQuestion } from './sectionquestion.entity';
import { ResponseEntity } from './response.entity';
import { QuestionResponse } from './questionresponse.entity';
import { QuestionList } from './questionlist.entity';

import { UpdateSurveyDto } from './dtos/update-survey.dto';
import { UpdateSectionDto } from './dtos/update-section.dto';
import { UpdateQuestionDto } from './dtos/update-question.dto';

import { CreateSectionDto } from './dtos/create-section.dto';
import { CreateQuestionDto } from './dtos/create-question.dto';
import { AddResponseDto } from './dtos/add-response.dto';
import { CreateListDto } from './dtos/create-list.dto';
import { AddQuestionToListDto } from './dtos/add-question-to-list.dto';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function cap(s: string | undefined | null, n: number) {
  if (s == null) return s as any;
  const t = s.trim();
  return t.length > n ? t.slice(0, n) : t;
}
function mapDuplicate(e: any, msg: string) {
  const code = e?.code || e?.errno;
  const s = String(e?.sqlMessage || e?.message || '');
  if (code === 'ER_DUP_ENTRY' || s.includes('Duplicate entry')) {
    throw new ConflictException(msg);
  }
  throw e;
}

function normOrderDir(dir?: string, def: 'ASC'|'DESC' = 'ASC'): 'ASC'|'DESC' {
  const d = (dir || def).toUpperCase();
  return d === 'DESC' ? 'DESC' : 'ASC';
}
function buildMeta(params: {
  page: number; limit: number; totalItems: number;
  orderBy: string; orderDir: 'ASC'|'DESC'; q?: string; filters?: Record<string, any>;
}) {
  const { page, limit, totalItems, orderBy, orderDir, q, filters } = params;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, limit)));
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    orderBy,
    orderDir,
    ...(q ? { q } : {}),
    ...(filters ? { filters } : {}),
  };
}

@Injectable()
export class SurveysService {
  constructor(
    @InjectRepository(Survey) private surveys: Repository<Survey>,
    @InjectRepository(Section) private sections: Repository<Section>,
    @InjectRepository(Question) private questions: Repository<Question>,
    @InjectRepository(SurveySection) private ss: Repository<SurveySection>,
    @InjectRepository(SectionQuestion) private sq: Repository<SectionQuestion>,
    @InjectRepository(ResponseEntity) private responses: Repository<ResponseEntity>,
    @InjectRepository(QuestionResponse) private qr: Repository<QuestionResponse>,
    @InjectRepository(QuestionList) private qlist: Repository<QuestionList>,
    private readonly ds: DataSource,
  ) {}



async compactSectionOrderSafe(sectionId: number) {
  const rows: any[] = await this.ds.query(
    'SELECT idQuestion FROM sectionquestion WHERE idSection = ? ORDER BY `order` ASC, idQuestion ASC',
    [sectionId],
  );

  let rn = 1;
  for (const r of rows) {
    await this.ds.query(
      'UPDATE sectionquestion SET `order` = ? WHERE idSection = ? AND idQuestion = ?',
      [rn++, sectionId, r.idQuestion],
    );
  }
}



private async ensureWritableSection(surveyId: number, sectionId: number): Promise<number> {
  const [cntRow] = await this.ds.query(
    'SELECT COUNT(*) AS n FROM `surveysection` WHERE `idSection` = ?',
    [sectionId],
  );
  const n = Number((cntRow as any)?.n ?? 0);

  if (n <= 1) {
    return sectionId;
  }

  const [secRow] = await this.ds.query(
    'SELECT `name`, `question_optional`, `idCoordinator` FROM `section` WHERE `id` = ? AND `deleted` = 0 LIMIT 1',
    [sectionId],
  );
  if (!secRow) throw new Error('Sección no encontrada/activa para COW');

  const name = secRow.name as string;
  const question_optional = secRow.question_optional ?? null;
  const idCoordinator = (secRow.idCoordinator ?? null);

  const ins: any = await this.ds.query(
    'INSERT INTO `section` (`name`, `question_optional`, `deleted`, `idCoordinator`) VALUES (?, ?, 0, ?)',
    [name, question_optional, idCoordinator],
  );
  const newSectionId = Number(ins.insertId);
  if (!newSectionId) throw new Error('No se pudo clonar la sección (COW)');

  await this.ds.query(
    'INSERT INTO `sectionquestion` (`idSection`, `idQuestion`, `order`) ' +
      'SELECT ?, `idQuestion`, `order` FROM `sectionquestion` WHERE `idSection` = ?',
    [newSectionId, sectionId],
  );

  await this.ds.query(
    'UPDATE `surveysection` SET `idSection` = ? WHERE `idSurvey` = ? AND `idSection` = ?',
    [newSectionId, surveyId, sectionId],
  );

  await this.compactSectionOrderSafe(newSectionId);

  return newSectionId;
}



async attachQuestionsCow(
  surveyId: number,
  sectionId: number,
  dto: { questionIds: number[]; insertAfterOrder?: number | null },
) {
  const writable = await this.ensureWritableSection(surveyId, sectionId);

  let base = dto.insertAfterOrder ?? null;
  if (base == null) {
    const [row] = await this.ds.query(
      'SELECT COALESCE(MAX(`order`), 0) AS m FROM `sectionquestion` WHERE `idSection` = ?',
      [writable],
    );
    base = Number((row as any)?.m ?? 0);
  }

  let next = base + 1;
  for (const qid of dto.questionIds ?? []) {
    await this.ds.query(
      'INSERT IGNORE INTO `sectionquestion` (`idSection`, `idQuestion`, `order`) VALUES (?, ?, ?)',
      [writable, qid, next++],
    );
  }

  await this.compactSectionOrderSafe(writable);

  return { ok: true, idSection: writable };
}



async createQuestionCow(
  surveyId: number,
  sectionId: number,
  dto: CreateQuestionDto, 
) {
  const writable = await this.ensureWritableSection(surveyId, sectionId);

  const name = (dto.name ?? '').trim();
  if (!name) throw new Error('El nombre de la pregunta es obligatorio');

  const res: any = await this.ds.query(
    'INSERT INTO `question` (`name`, `deleted`) VALUES (?, 0)',
    [name],
  );
  const qid = Number(res.insertId);
  if (!qid) throw new Error('No se pudo crear la pregunta');

  let order = dto.targetOrder ?? null;
  if (order == null) {
    const [row] = await this.ds.query(
      'SELECT COALESCE(MAX(`order`), 0) AS m FROM `sectionquestion` WHERE `idSection` = ?',
      [writable],
    );
    order = Number((row as any)?.m ?? 0) + 1;
  }

  await this.ds.query(
    'INSERT INTO `sectionquestion` (`idSection`, `idQuestion`, `order`) VALUES (?, ?, ?)',
    [writable, qid, order],
  );

  await this.compactSectionOrderSafe(writable);

  return { id: qid, idSection: writable, order };
}




async detachQuestionCow(
  surveyId: number,
  sectionId: number,
  questionId: number,
) {
  const writable = await this.ensureWritableSection(surveyId, sectionId);

  const del: any = await this.ds.query(
    'DELETE FROM `sectionquestion` WHERE `idSection` = ? AND `idQuestion` = ?',
    [writable, questionId],
  );

  await this.compactSectionOrderSafe(writable);

  return {
    ok: true,
    affected: del.affectedRows ?? del[0]?.affectedRows ?? 0,
    idSection: writable,
  };
}


async detachSection(surveyId: number, sectionId: number) {
  const res: any = await this.ds.query(
    'DELETE FROM `surveysection` WHERE `idSurvey` = ? AND `idSection` = ?',
    [surveyId, sectionId],
  );
  return { ok: true, affected: res.affectedRows ?? res[0]?.affectedRows ?? 0 };
}



async searchSurveys(dto: {
  id?: number;
  name?: string;
  type?: number | string;
  q?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'ASC'|'DESC'|'asc'|'desc';
}) {
  const page  = Math.max(1, Number(dto.page ?? 1));
  const limit = Math.max(1, Math.min(Number(dto.limit ?? 20), 100));
  const offset = (page - 1) * limit;

  const sortMap: Record<string, string> = {
    date_insert: 's.`date_insert`',
    name:        's.`name`',
    id:          's.`id`',
    type:        's.`type`',
  };
  const orderBy = sortMap[(dto.orderBy ?? 'date_insert').toLowerCase()] ?? 's.`date_insert`';
  const orderDir = normOrderDir(dto.orderDir ?? 'DESC');

  const where: string[] = ['s.`deleted` = 0'];
  const params: any[] = [];

  if (dto.id !== undefined && dto.id !== null && String(dto.id).trim() !== '') {
    where.push('s.`id` = ?'); params.push(Number(dto.id));
  }
  if (dto.name && dto.name.trim() !== '') {
    where.push('s.`name` LIKE ?'); params.push(`%${dto.name.trim()}%`);
  }
  if (dto.type !== undefined && dto.type !== null && String(dto.type).trim() !== '') {
    const t = Number(dto.type);
    if (Number.isFinite(t) && (t === 0 || t === 1)) {
      where.push('s.`type` = ?'); params.push(t);
    }
  }
  if (dto.q && dto.q.trim() !== '') {
    const q = dto.q.trim();
    const maybeId = Number(q);
    if (Number.isFinite(maybeId)) {
      where.push('(s.`id` = ? OR s.`name` LIKE ?)');
      params.push(maybeId, `%${q}%`);
    } else {
      where.push('(s.`name` LIKE ?)');
      params.push(`%${q}%`);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await this.surveys.query(
    `SELECT COUNT(*) AS cnt FROM \`survey\` s ${whereSql}`,
    params,
  );
  const totalItems = Number(totalRow?.[0]?.cnt ?? 0);

  const rows = await this.surveys.query(
    `SELECT s.\`id\`, s.\`name\`, s.\`type\`, s.\`date_insert\`, s.\`date_update\`
       FROM \`survey\` s
       ${whereSql}
       ORDER BY ${orderBy} ${orderDir}, s.\`id\` ${orderDir}
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const meta = buildMeta({
    page, limit, totalItems,
    orderBy: Object.keys(sortMap).find(k => sortMap[k] === orderBy) ?? 'date_insert',
    orderDir,
    q: dto.q,
    filters: {
      ...(dto.id   !== undefined ? { id: dto.id }   : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: Number(dto.type) } : {}),
    },
  });

  return { data: rows, meta };
}

async listSurveys() {
  return this.surveys.query(
    `SELECT id, name, type, date_insert, date_update
       FROM \`survey\`
      WHERE deleted = 0
      ORDER BY date_insert DESC`,
  );
}


async getSurveyTree(idSurvey: number) {
  const [survey] = await this.surveys.query(
    'SELECT `id`, `name` FROM `survey` WHERE `id` = ? AND `deleted` = 0 LIMIT 1',
    [idSurvey],
  );
  if (!survey) throw new NotFoundException('Survey no encontrada');

  const sections = await this.ds.query(
    `SELECT s.\`id\`, s.\`name\`, s.\`question_optional\`, ss.\`order\`
       FROM \`surveysection\` ss
       INNER JOIN \`section\` s
               ON s.\`id\` = ss.\`idSection\` AND s.\`deleted\` = 0
      WHERE ss.\`idSurvey\` = ?
      ORDER BY ss.\`order\` ASC`,
    [idSurvey],
  );

  const questionsBySection = new Map<number, any[]>();
  if (sections.length) {
    const sectionIds = sections.map((s: any) => Number(s.id));
    const rows = await this.ds.query(
      `SELECT
         sq.\`idSection\` AS idSection,
         q.\`id\`         AS id,
         q.\`name\`       AS name,
         sq.\`order\`     AS \`order\`
       FROM \`sectionquestion\` sq
       INNER JOIN \`question\` q
               ON q.\`id\` = sq.\`idQuestion\` AND q.\`deleted\` = 0
      WHERE sq.\`idSection\` IN (${sectionIds.map(() => '?').join(',')})
      ORDER BY sq.\`idSection\` ASC, sq.\`order\` ASC`,
      sectionIds,
    );

    for (const r of rows) {
      const sid = Number(r.idSection);
      if (!questionsBySection.has(sid)) questionsBySection.set(sid, []);
      questionsBySection.get(sid)!.push({
        id: Number(r.id),
        name: r.name,
        order: Number(r.order),
      });
    }
  }

  return {
    id: Number(survey.id),
    name: survey.name as string,
    sections: sections.map((s: any) => {
      const sid = Number(s.id);
      return {
        id: sid,
        name: s.name,
        order: Number(s.order),
        question_optional: s.question_optional ?? null,
        questions: (questionsBySection.get(sid) ?? []),
      };
    }),
  };
}





async getSectionTree(idSection: number) {
  const [sec] = await this.sections.query(
    'SELECT `id`, `name`, `question_optional` FROM `section` WHERE `id` = ? AND `deleted` = 0 LIMIT 1',
    [idSection],
  );
  if (!sec) throw new NotFoundException('Sección no encontrada/activa');

const questions = await this.ds.query(
  `SELECT
     CAST(sq.\`idQuestion\` AS UNSIGNED) AS id,
     q.\`name\`                           AS name,
     CAST(sq.\`order\` AS UNSIGNED)      AS \`order\`
   FROM \`sectionquestion\` sq
   INNER JOIN \`question\` q
           ON q.\`id\` = sq.\`idQuestion\` AND q.\`deleted\` = 0
  WHERE sq.\`idSection\` = ?
    AND NOT EXISTS (
      SELECT 1 FROM questionquestionlist qql
      WHERE qql.idQuestion = q.id   -- <-- sin qql.deleted
    )
  ORDER BY sq.\`order\` ASC`,
  [idSection],
);


  const responsesByQuestion = new Map<number, any[]>();
  if (questions.length) {
    const qIds = questions.map((r: any) => r.id);
    const placeholders = qIds.map(() => '?').join(',');

    const rows = await this.ds.query(
      `SELECT
         CAST(qr.\`idQuestion\` AS UNSIGNED)           AS idQuestion,
         CAST(r.\`id\` AS UNSIGNED)                    AS id,
         r.\`name\`                                    AS name,
         CAST(r.\`type\` AS SIGNED)                    AS \`type\`,
         CAST(NULLIF(r.\`min\`, '') AS SIGNED)         AS \`min\`,
         CAST(NULLIF(r.\`max\`, '') AS SIGNED)         AS \`max\`,
         r.\`unity\`                                   AS \`unity\`,
         CAST(qr.\`order\` AS UNSIGNED)                AS \`order\`
       FROM \`questionresponse\` qr
       INNER JOIN \`response\` r
               ON r.\`id\` = qr.\`idResponse\` AND r.\`deleted\` = 0
      WHERE qr.\`deleted\` = 0 AND qr.\`idQuestion\` IN (${placeholders})
      ORDER BY qr.\`idQuestion\` ASC, qr.\`order\` ASC`,
      qIds,
    );

    for (const r of rows) {
      if (!responsesByQuestion.has(r.idQuestion)) responsesByQuestion.set(r.idQuestion, []);
      responsesByQuestion.get(r.idQuestion)!.push({
        id: r.id,
        name: r.name,
        type: r.type,
        min: r.min,
        max: r.max,
        unity: r.unity,
        order: r.order,
      });
    }
  }

return {
  id: Number(sec.id),
  name: sec.name,
  question_optional: sec.question_optional ?? null,
  questions: questions.map((q: any) => ({
    id: Number(q.id),
    name: q.name,
    order: Number(q.order),
    responses: (responsesByQuestion.get(q.id) ?? []).map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      type: r.type === null || r.type === undefined ? null : Number(r.type),
      min: r.min === null || r.min === '' ? null : Number(r.min),
      max: r.max === null || r.max === '' ? null : Number(r.max),
      unity: r.unity ?? null,
      order: Number(r.order),
    })),
  })),
};

}



async getSectionsTree(ids: number[]) {
  const unique = Array.from(new Set(ids.map(Number).filter((x) => Number.isFinite(x) && x > 0)));
  if (!unique.length) return [];

  const placeholders = unique.map(() => '?').join(',');
  const secs = await this.ds.query(
    `SELECT
       CAST(id AS UNSIGNED)      AS id,
       name,
       question_optional
     FROM \`section\`
    WHERE deleted = 0 AND id IN (${placeholders})
    ORDER BY id ASC`,
    unique,
  );
  if (!secs.length) return [];

  const secIds = secs.map((s: any) => s.id);

const qRows = await this.ds.query(
  `SELECT
     CAST(sq.\`idSection\` AS UNSIGNED)   AS idSection,
     CAST(sq.\`idQuestion\` AS UNSIGNED)  AS id,
     q.\`name\`                            AS name,
     CAST(sq.\`order\` AS UNSIGNED)       AS \`order\`
   FROM \`sectionquestion\` sq
   INNER JOIN \`question\` q
           ON q.\`id\` = sq.\`idQuestion\` AND q.\`deleted\` = 0
  WHERE sq.\`idSection\` IN (${secIds.map(() => '?').join(',')})
    AND NOT EXISTS (
      SELECT 1 FROM questionquestionlist qql
      WHERE qql.idQuestion = q.id   -- <-- sin qql.deleted
    )
  ORDER BY sq.\`idSection\` ASC, sq.\`order\` ASC`,
  secIds,
);


  const questionsBySec = new Map<number, any[]>();
  const allQids: number[] = [];
  for (const r of qRows) {
    if (!questionsBySec.has(r.idSection)) questionsBySec.set(r.idSection, []);
    questionsBySec.get(r.idSection)!.push({ id: r.id, name: r.name, order: r.order });
    allQids.push(r.id);
  }

  const responsesByQuestion = new Map<number, any[]>();
  if (allQids.length) {
    const rows = await this.ds.query(
      `SELECT
         CAST(qr.\`idQuestion\` AS UNSIGNED)           AS idQuestion,
         CAST(r.\`id\` AS UNSIGNED)                    AS id,
         r.\`name\`                                    AS name,
         CAST(r.\`type\` AS SIGNED)                    AS \`type\`,
         CAST(NULLIF(r.\`min\`, '') AS SIGNED)         AS \`min\`,
         CAST(NULLIF(r.\`max\`, '') AS SIGNED)         AS \`max\`,
         r.\`unity\`                                   AS \`unity\`,
         CAST(qr.\`order\` AS UNSIGNED)                AS \`order\`
       FROM \`questionresponse\` qr
       INNER JOIN \`response\` r
               ON r.\`id\` = qr.\`idResponse\` AND r.\`deleted\` = 0
      WHERE qr.\`deleted\` = 0 AND qr.\`idQuestion\` IN (${allQids.map(() => '?').join(',')})
      ORDER BY qr.\`idQuestion\` ASC, qr.\`order\` ASC`,
      allQids,
    );
    for (const r of rows) {
      if (!responsesByQuestion.has(r.idQuestion)) responsesByQuestion.set(r.idQuestion, []);
      responsesByQuestion.get(r.idQuestion)!.push({
        id: r.id,
        name: r.name,
        type: r.type,
        min: r.min,
        max: r.max,
        unity: r.unity,
        order: r.order,
      });
    }
  }

return secs.map((s: any) => {
  const qs = (questionsBySec.get(s.id) ?? []).map((q: any) => ({
    id: Number(q.id),
    name: q.name,
    order: Number(q.order),
    responses: (responsesByQuestion.get(q.id) ?? []).map((r: any) => ({
      id: Number(r.id),
      name: r.name,
      type: r.type === null || r.type === undefined ? null : Number(r.type),
      min: r.min === null || r.min === '' ? null : Number(r.min),
      max: r.max === null || r.max === '' ? null : Number(r.max),
      unity: r.unity ?? null,
      order: Number(r.order),
    })),
  }));

  return {
    id: Number(s.id),
    name: s.name,
    question_optional: s.question_optional ?? null,
    questions: qs,
  };
});

}


  async updateSurvey(id: number, dto: UpdateSurveyDto) {
  const s = await this.surveys.findOne({ where: { id } });
  if (!s) throw new NotFoundException('Survey no encontrada');

  const patch: Partial<Survey> = {};

  if (dto.name !== undefined) {
    const v = cap(dto.name, 45);
    if (!v) throw new BadRequestException('name no puede estar vacío');
    (patch as any).name = v;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, id, unchanged: true };
  }

  try {
    await this.surveys.update({ id }, patch);
    return { ok: true, id };
  } catch (e: any) {
    mapDuplicate(e, 'Ya existe una encuesta con ese nombre');
  }
}


async updateSection(idSection: number, dto: UpdateSectionDto) {
  const rel = await this.ss.findOne({ where: { idSection } });
  if (!rel) throw new NotFoundException('Sección no encontrada en ningún survey');

  await this.ds.transaction(async (trx) => {
    if (dto.name !== undefined) {
      const exclusiveId = await this.ensureExclusiveSectionForSurvey(rel.idSurvey, idSection);
      if (exclusiveId !== idSection) idSection = exclusiveId;
    }

    if (dto.name !== undefined) {
      await trx.getRepository(Section).update(
        { id: idSection },
        { name: cap(dto.name, 200) } as any,
      );
    }

    if (dto.targetOrder !== undefined) {
      const repoSS = trx.getRepository(SurveySection);
      const siblings = await repoSS.find({
        where: { idSurvey: rel.idSurvey },
        order: { order: 'ASC' as any },
      });

      const idx = siblings.findIndex((x) => x.idSection === idSection);
      if (idx === -1) throw new NotFoundException('Relación survey-section no encontrada');

      const current = siblings[idx].order;
      const target = clamp(dto.targetOrder!, 1, siblings.length);

      if (target !== current) {
        const moving = siblings.splice(idx, 1)[0];
        siblings.splice(target - 1, 0, moving);
        for (let i = 0; i < siblings.length; i++) {
          const desired = i + 1;
          const r = siblings[i];
          if (r.order !== desired) {
            await repoSS.update(
              { idSurvey: r.idSurvey, idSection: r.idSection },
              { order: desired } as any,
            );
          }
        }
      }
    }
  });

  return { ok: true, id: idSection };
}


async updateQuestion(idQuestion: number, dto: UpdateQuestionDto) {
  const rel = await this.sq.findOne({ where: { idQuestion } });
  if (!rel) throw new NotFoundException('Pregunta no encontrada en ninguna sección');

  await this.ds.transaction(async (trx) => {
    if (dto.name !== undefined) {
      const exclusiveId = await this.ensureExclusiveQuestionForSection(rel.idSection, idQuestion);
      if (exclusiveId !== idQuestion) idQuestion = exclusiveId;
    }

    if (dto.name !== undefined) {
      await trx.getRepository(Question).update(
        { id: idQuestion },
        { name: cap(dto.name, 400) } as any,
      );
    }

    if (dto.targetOrder !== undefined) {
      const repoSQ = trx.getRepository(SectionQuestion);
      const siblings = await repoSQ.find({
        where: { idSection: rel.idSection },
        order: { order: 'ASC' as any },
      });

      const idx = siblings.findIndex((x) => x.idQuestion === idQuestion);
      if (idx === -1) throw new NotFoundException('Relación section-question no encontrada');

      const current = siblings[idx].order;
      const target = clamp(dto.targetOrder!, 1, siblings.length);

      if (target !== current) {
        const moving = siblings.splice(idx, 1)[0];
        siblings.splice(target - 1, 0, moving);
        for (let i = 0; i < siblings.length; i++) {
          const desired = i + 1;
          const r = siblings[i];
          if (r.order !== desired) {
            await repoSQ.update(
              { idSection: r.idSection, idQuestion: r.idQuestion },
              { order: desired } as any,
            );
          }
        }
      }
    }
  });

  return { ok: true, id: idQuestion };
}


  async deleteSurvey(id: number) {
    const exists = await this.surveys.findOne({ where: { id } });
    if (!exists) throw new NotFoundException('Survey no encontrada');

    const [ref] = await this.ds.query(
      'SELECT 1 AS ok FROM `group` WHERE story = ? OR revision = ? LIMIT 1',
      [id, id],
    );
    if (ref?.ok) {
      throw new ConflictException('La encuesta está asignada a uno o más grupos (story/revision). Desvincúlala primero.');
    }

    await this.ds.transaction(async (trx) => {
      await trx.getRepository(SurveySection).delete({ idSurvey: id } as any);
      await trx.query('DELETE FROM `surveyindex` WHERE idSurvey = ?', [id]);
      await trx.query('UPDATE `survey` SET deleted = 1 WHERE id = ?', [id]);
    });

    return { ok: true, id };
  }

  async deleteSection(idSection: number) {
    const rel = await this.ss.findOne({ where: { idSection } });
    if (!rel) throw new NotFoundException('Sección no encontrada en ningún survey');

    await this.ds.transaction(async (trx) => {
      await trx.getRepository(SectionQuestion).delete({ idSection } as any);

      const repoSS = trx.getRepository(SurveySection);
      await repoSS.delete({ idSurvey: rel.idSurvey, idSection } as any);

      const siblings = await repoSS.find({
        where: { idSurvey: rel.idSurvey },
        order: { order: 'ASC' as any },
      });
      for (let i = 0; i < siblings.length; i++) {
        const desired = i + 1;
        const r = siblings[i];
        if (r.order !== desired) {
          await repoSS.update({ idSurvey: r.idSurvey, idSection: r.idSection }, { order: desired } as any);
        }
      }

      await trx.query('UPDATE `section` SET deleted = 1 WHERE id = ?', [idSection]);
    });

    return { ok: true, id: idSection };
  }

  async deleteQuestion(idQuestion: number) {
    const rel = await this.sq.findOne({ where: { idQuestion } });
    if (!rel) throw new NotFoundException('Pregunta no encontrada en ninguna sección');

    await this.ds.transaction(async (trx) => {
      const repoSQ = trx.getRepository(SectionQuestion);
      await repoSQ.delete({ idSection: rel.idSection, idQuestion } as any);

      const siblings = await repoSQ.find({
        where: { idSection: rel.idSection },
        order: { order: 'ASC' as any },
      });
      for (let i = 0; i < siblings.length; i++) {
        const desired = i + 1;
        const r = siblings[i];
        if (r.order !== desired) {
          await repoSQ.update({ idSection: r.idSection, idQuestion: r.idQuestion }, { order: desired } as any);
        }
      }

      await trx.query('DELETE FROM `questionresponse` WHERE idQuestion = ?', [idQuestion]);
      await trx.query('DELETE FROM `questionquestionlist` WHERE idQuestion = ?', [idQuestion]);
      await trx.query('DELETE FROM `indexquestion` WHERE idQuestion = ?', [idQuestion]);
      await trx.query('UPDATE `question` SET deleted = 1 WHERE id = ?', [idQuestion]);
    });

    return { ok: true, id: idQuestion };
  }


async createSectionAndAttach(
  idSurvey: number,
  dto: CreateSectionDto,
  currentUser: { sub?: number; id?: number; role?: string; roles?: any },
) {
  const isCoordinator =
    !!currentUser?.roles?.coordinator || currentUser?.role === 'coordinator';
  if (!isCoordinator) throw new ForbiddenException();

  const coordinatorId = Number(currentUser?.sub ?? currentUser?.id);
  if (!Number.isFinite(coordinatorId) || coordinatorId < 1) {
    throw new BadRequestException('Token sin identificador de coordinador válido');
  }

  const survey = await this.surveys.findOne({ where: { id: idSurvey, deleted: 0 as any } });
  if (!survey) throw new NotFoundException('Survey no encontrada/activa');

  const name = cap(dto.name, 200);
  if (!name) throw new BadRequestException('name requerido');

  const [coord] = await this.ds.query(
    'SELECT 1 AS ok FROM `coordinator` WHERE id = ? LIMIT 1',
    [coordinatorId],
  );
  if (!coord?.ok) {
    throw new ConflictException(
      `El usuario (${coordinatorId}) no tiene fila en "coordinator". Crea el coordinador antes de añadir secciones.`,
    );
  }

  return this.ds.transaction(async (trx) => {
    const section = trx.getRepository(Section).create({
      name,
      idCoordinator: coordinatorId as any,
      deleted: 0 as any,
    });
    const saved = await trx.getRepository(Section).save(section);

    const [{ c } = { c: 0 }] = await trx.query(
      'SELECT COUNT(*) AS c FROM surveysection WHERE idSurvey = ?',
      [idSurvey],
    );
    const target = clamp(dto.targetOrder ?? c + 1, 1, c + 1);

    await trx.query(
      'UPDATE surveysection SET `order` = `order` + 1 WHERE idSurvey = ? AND `order` >= ?',
      [idSurvey, target],
    );
    try {
      await trx.query(
        'INSERT INTO surveysection (idSurvey, idSection, `order`) VALUES (?, ?, ?)',
        [idSurvey, saved.id, target],
      );
    } catch (e) {
      mapDuplicate(e, 'La sección ya está vinculada a este survey');
    }

    return { id: saved.id, name: saved.name, order: target, idSurvey };
  });
}


async createQuestionAndAttach(
  idSection: number,
  dto: CreateQuestionDto,
  currentUser: { id: number; roles: any },
) {
  if (!currentUser?.roles?.coordinator) throw new ForbiddenException();

  const section = await this.sections.findOne({ where: { id: idSection, deleted: 0 as any } });
  if (!section) throw new NotFoundException('Sección no encontrada/activa');

  const rel = await this.ss.findOne({ where: { idSection } });
  if (!rel) throw new NotFoundException('Sección no enlazada a ningún formulario');

  {
    const exclusiveId = await this.ensureExclusiveSectionForSurvey(rel.idSurvey, idSection);
    if (exclusiveId !== idSection) idSection = exclusiveId;
  }

  const name = cap(dto.name, 400);
  if (!name) throw new BadRequestException('name requerido');

  return this.ds.transaction(async (trx) => {
    const q = this.questions.create({
      name,
      idCoordinator: currentUser.id as any,
      deleted: 0 as any,
    });
    const saved = await trx.getRepository(Question).save(q);

    const [{ c } = { c: 0 }] = await this.ds.query(
      'SELECT COUNT(*) AS c FROM sectionquestion WHERE idSection = ?',
      [idSection],
    );
    const target = clamp(dto.targetOrder ?? c + 1, 1, c + 1);

    await trx.query(
      'UPDATE sectionquestion SET `order` = `order` + 1 WHERE idSection = ? AND `order` >= ?',
      [idSection, target],
    );

    try {
      await trx.query(
        'INSERT INTO sectionquestion (idSection, idQuestion, `order`) VALUES (?, ?, ?)',
        [idSection, saved.id, target],
      );
    } catch (e) {
      mapDuplicate(e, 'La pregunta ya está vinculada a esta sección');
    }

    return { id: saved.id, name: saved.name, order: target, idSection };
  });
}


async createResponseAndAttach(
  idQuestion: number,
  dto: { name: string; type?: number; targetOrder?: number; unity?: string | null; min?: string | null; max?: string | null },
  currentUser: { id?: number; roles?: any }
) {
  if (!currentUser?.roles?.coordinator) throw new ForbiddenException();

  await this.assertNotItemQuestion(idQuestion);

  const q = await this.questions.findOne({ where: { id: idQuestion, deleted: 0 as any } });
  if (!q) throw new NotFoundException('Pregunta no encontrada/activa');
  const name = cap(dto.name, 200);
  if (!name) throw new BadRequestException('name requerido');

  const type = dto.type == null ? null : Number(dto.type);
  const unity = (dto.unity ?? '').toString().trim();
  const min   = (dto.min   ?? '').toString().trim();
  const max   = (dto.max   ?? '').toString().trim();

  return this.ds.transaction(async (trx) => {
    const hasIdCoord = (await trx.query("SHOW COLUMNS FROM `response` LIKE 'idCoordinator'")).length > 0;

    let insertSql = 'INSERT INTO `response` (';
    const cols: string[] = ['`name`', '`deleted`'];
    const params: any[] = [name, 0];
    if (type != null && Number.isFinite(type)) { cols.push('`type`'); params.push(type); }
    if (unity.length > 0) { cols.push('`unity`'); params.push(unity); }
    if (min.length   > 0) { cols.push('`min`');   params.push(min);   }
    if (max.length   > 0) { cols.push('`max`');   params.push(max);   }
    if (hasIdCoord && Number.isFinite(currentUser?.id)) { cols.push('`idCoordinator`'); params.push(Number(currentUser!.id)); }
    insertSql += cols.join(', ') + ') VALUES (' + cols.map(() => '?').join(', ') + ')';

    const res: any = await trx.query(insertSql, params);
    const idResponse = Number(res?.insertId);
    if (!idResponse) throw new BadRequestException('No se pudo crear la respuesta');

    const [{ c } = { c: 0 }] = await trx.query(
      'SELECT COUNT(*) AS c FROM questionresponse WHERE idQuestion = ? AND deleted = 0',
      [idQuestion],
    );
    const target = (() => {
      const curr = Number(c ?? 0);
      const after = dto.targetOrder;
      return after == null ? curr + 1 : clamp(Number(after) + 1, 1, curr + 1);
    })();

    await trx.query(
      'UPDATE questionresponse SET `order` = `order` + 1 WHERE idQuestion = ? AND deleted = 0 AND `order` >= ?',
      [idQuestion, target],
    );

    await trx.query(
      'INSERT INTO questionresponse (idQuestion, idResponse, deleted, `order`) VALUES (?, ?, 0, ?)',
      [idQuestion, idResponse, target],
    );

    const listId = (q as any).questionList ?? null;
    if (listId != null) {
      const items: Array<{ idQuestion: number }> = await trx.query(
        'SELECT idQuestion FROM questionquestionlist WHERE idQuestionList = ? ORDER BY `order` ASC',
        [listId],
      );

      for (const it of items) {
        const [exists] = await trx.query(
          'SELECT 1 AS ok FROM questionresponse WHERE idQuestion = ? AND idResponse = ?',
          [it.idQuestion, idResponse],
        );
        if (!exists) {
          const [{ c: ci } = { c: 0 }] = await trx.query(
            'SELECT COUNT(*) AS c FROM questionresponse WHERE idQuestion = ? AND deleted = 0',
            [it.idQuestion],
          );
          const pos = Number(ci ?? 0) + 1;
          await trx.query(
            'INSERT INTO questionresponse (idQuestion, idResponse, deleted, `order`) VALUES (?, ?, 0, ?)',
            [it.idQuestion, idResponse, pos],
          );
        }
      }
    }

    return { ok: true, idQuestion, idResponse, name, order: target };
  });
}


async addResponseToQuestion(idQuestion: number, dto: AddResponseDto) {
  await this.assertNotItemQuestion(idQuestion);

  const q = await this.questions.findOne({ where: { id: idQuestion, deleted: 0 as any } });
  if (!q) throw new NotFoundException('Pregunta no encontrada/activa');

  const r = await this.responses.findOne({ where: { id: dto.idResponse, deleted: 0 as any } });
  if (!r) throw new NotFoundException('Respuesta no encontrada/activa');

  return this.ds.transaction(async (trx) => {
    const repoQR = trx.getRepository(QuestionResponse);
    const existing = await repoQR.findOne({ where: { idQuestion, idResponse: dto.idResponse } as any });

    const [{ c } = { c: 0 }] = await trx.query(
      'SELECT COUNT(*) AS c FROM questionresponse WHERE idQuestion = ? AND deleted = 0',
      [idQuestion],
    );
    const target = clamp((existing ? (existing as any).order : (c as number) + 1), 1, (c as number) + 1);

    await trx.query(
      'UPDATE questionresponse SET `order` = `order` + 1 WHERE idQuestion = ? AND deleted = 0 AND `order` >= ?',
      [idQuestion, target],
    );

    if (!existing) {
      await trx.query(
        `INSERT INTO questionresponse (idQuestion, idResponse, deleted, \`order\`)
         VALUES (?, ?, 0, ?)`,
        [idQuestion, dto.idResponse, target],
      );
    } else if ((existing as any).deleted === 1) {
      await trx.query(
        `UPDATE questionresponse SET deleted = 0, \`order\` = ?, date_update = NOW()
         WHERE idQuestion = ? AND idResponse = ?`,
        [target, idQuestion, dto.idResponse],
      );
    } else {
      await trx.query(
        `UPDATE questionresponse SET \`order\` = ?, date_update = NOW()
         WHERE idQuestion = ? AND idResponse = ?`,
        [target, idQuestion, dto.idResponse],
      );
    }

    const listId = (q as any).questionList ?? null;
    if (listId != null) {
      const items: Array<{ idQuestion: number }> = await trx.query(
        'SELECT idQuestion FROM questionquestionlist WHERE idQuestionList = ? ORDER BY `order` ASC',
        [listId],
      );
      for (const it of items) {
        const [e2] = await trx.query(
          'SELECT 1 AS ok FROM questionresponse WHERE idQuestion = ? AND idResponse = ?',
          [it.idQuestion, dto.idResponse],
        );
        if (!e2) {
          const [{ c: ci } = { c: 0 }] = await trx.query(
            'SELECT COUNT(*) AS c FROM questionresponse WHERE idQuestion = ? AND deleted = 0',
            [it.idQuestion],
          );
          const pos = Number(ci ?? 0) + 1;
          await trx.query(
            'INSERT INTO questionresponse (idQuestion, idResponse, deleted, `order`) VALUES (?, ?, 0, ?)',
            [it.idQuestion, dto.idResponse, pos],
          );
        }
      }
    }

    return { ok: true, idQuestion, idResponse: dto.idResponse, order: target };
  });
}


async addResponseToQuestionInSection(
  idSection: number,
  idQuestion: number,
  dto: AddResponseDto,
) {
  await this.assertNotItemQuestion(idQuestion);

  idQuestion = await this.ensureExclusiveQuestionForSection(idSection, idQuestion);

  const q = await this.questions.findOne({ where: { id: idQuestion, deleted: 0 as any } });
  if (!q) throw new NotFoundException('Pregunta no encontrada/activa');

  const r = await this.responses.findOne({ where: { id: dto.idResponse, deleted: 0 as any } });
  if (!r) throw new NotFoundException('Respuesta no encontrada/activa');

  return this.ds.transaction(async (trx) => {
    const repoQR = trx.getRepository(QuestionResponse);
    const existing = await repoQR.findOne({ where: { idQuestion, idResponse: dto.idResponse } as any });

    const [{ c } = { c: 0 }] = await trx.query(
      'SELECT COUNT(*) AS c FROM questionresponse WHERE idQuestion = ? AND deleted = 0',
      [idQuestion],
    );
    const target = clamp(dto.targetOrder ?? c + 1, 1, c + 1);

    await trx.query(
      'UPDATE questionresponse SET `order` = `order` + 1 WHERE idQuestion = ? AND deleted = 0 AND `order` >= ?',
      [idQuestion, target],
    );

    if (!existing) {
      await trx.query(
        `INSERT INTO questionresponse (idQuestion, idResponse, deleted, \`order\`)
         VALUES (?, ?, 0, ?)`,
        [idQuestion, dto.idResponse, target],
      );
    } else if ((existing as any).deleted === 1) {
      await trx.query(
        `UPDATE questionresponse SET deleted = 0, \`order\` = ?, date_update = NOW()
         WHERE idQuestion = ? AND idResponse = ?`,
        [target, idQuestion, dto.idResponse],
      );
    } else {
      await trx.query(
        `UPDATE questionresponse SET \`order\` = ?, date_update = NOW()
         WHERE idQuestion = ? AND idResponse = ?`,
        [target, idQuestion, dto.idResponse],
      );
    }

    return { ok: true, idSection, idQuestion, idResponse: dto.idResponse, order: target };
  });
}


  async createListForQuestion(idQuestionOwner: number, dto: CreateListDto, currentUser: { id: number; roles: any }) {
    if (!currentUser?.roles?.coordinator) throw new ForbiddenException();

    const owner = await this.questions.findOne({ where: { id: idQuestionOwner, deleted: 0 as any } });
    if (!owner) throw new NotFoundException('Pregunta propietaria no encontrada/activa');

    if ((owner as any).questionList != null) {
      throw new ConflictException('La pregunta ya tiene una lista asociada');
    }

    const listname = cap(dto.listname ?? 'Lista de elementos', 200);

    return this.ds.transaction(async (trx) => {
      const res = await trx.query('INSERT INTO questionlist (listname) VALUES (?)', [listname]);
      const listId = res.insertId as number;
      if (!listId) throw new BadRequestException('No se pudo crear la lista');

      await trx.query('UPDATE question SET questionList = ? WHERE id = ?', [listId, idQuestionOwner]);

      return { idList: listId, idQuestion: idQuestionOwner, listname };
    });
  }

async addQuestionToList(listId: number, dto: AddQuestionToListDto & { forceDetach?: boolean }) {
  const list = await this.qlist.findOne({ where: { id: listId } });
  if (!list) throw new NotFoundException('Lista no encontrada');

  const qItem = await this.questions.findOne({ where: { id: dto.idQuestion, deleted: 0 as any } });
  if (!qItem) throw new NotFoundException('Pregunta no encontrada/activa');

  const [exists] = await this.ds.query(
    'SELECT 1 AS ok FROM questionquestionlist WHERE idQuestionList = ? AND idQuestion = ? LIMIT 1',
    [listId, dto.idQuestion],
  );
  if (exists) throw new ConflictException('La pregunta ya pertenece a la lista');

  return this.ds.transaction(async (trx) => {
    const inSection = await trx.query(
      'SELECT idSection FROM sectionquestion WHERE idQuestion = ? LIMIT 1',
      [dto.idQuestion],
    );
    if (inSection.length) {
      if (!dto.forceDetach) {
        throw new ConflictException(
          'La pregunta está vinculada a una sección. Usa forceDetach=true para desvincularla antes de añadirla como ítem.',
        );
      }
      await trx.query(
        'DELETE FROM sectionquestion WHERE idQuestion = ?',
        [dto.idQuestion],
      );
    }

    let order = dto.order ?? null;
    if (order == null) {
      const [{ maxo } = { maxo: 0 }] = await trx.query(
        'SELECT COALESCE(MAX(`order`), 0) AS maxo FROM questionquestionlist WHERE idQuestionList = ?',
        [listId],
      );
      order = Number(maxo) + 1;
    } else {
      await trx.query(
        'UPDATE questionquestionlist SET `order` = `order` + 1 WHERE idQuestionList = ? AND `order` >= ?',
        [listId, order],
      );
    }

    await trx.query(
      'INSERT INTO questionquestionlist (idQuestionList, idQuestion, `order`) VALUES (?, ?, ?)',
      [listId, dto.idQuestion, order],
    );

    const [owner] = await trx.query(
      'SELECT id FROM question WHERE questionList = ? AND deleted = 0 LIMIT 1',
      [listId],
    );
    if (owner?.id) {
      await trx.query(
        `INSERT INTO questionresponse (idQuestion, idResponse, deleted, \`order\`)
         SELECT ?, qr_owner.idResponse, 0, qr_owner.\`order\`
           FROM questionresponse qr_owner
          WHERE qr_owner.idQuestion = ?
            AND qr_owner.deleted = 0
            AND NOT EXISTS (
              SELECT 1
                FROM questionresponse qr_item
               WHERE qr_item.idQuestion = ?
                 AND qr_item.idResponse = qr_owner.idResponse
            )`,
        [dto.idQuestion, owner.id, dto.idQuestion],
      );
      const rows = await trx.getRepository(QuestionResponse).find({
        where: { idQuestion: dto.idQuestion, deleted: 0 as any } as any,
        order: { order: 'ASC' as any },
      });
      for (let i = 0; i < rows.length; i++) {
        const desired = i + 1;
        if ((rows[i] as any).order !== desired) {
          await trx.getRepository(QuestionResponse).update(
            { idQuestion: (rows[i] as any).idQuestion, idResponse: (rows[i] as any).idResponse } as any,
            { order: desired } as any,
          );
        }
      }
    }

    return { ok: true, idList: listId, idQuestion: dto.idQuestion, order };
  });
}


async createSurvey(dto: { name: string; idCoordinator: number; type?: number }) {
  const name = (dto?.name ?? '').trim();
  if (!name) throw new BadRequestException('name requerido');

  const type = Number(dto?.type ?? 0); 
  if (![0, 1].includes(type)) throw new BadRequestException('type debe ser 0 o 1');

  if (!Number.isFinite(dto.idCoordinator) || dto.idCoordinator < 1) {
    throw new BadRequestException('idCoordinator requerido y > 0');
  }

  const payload: Partial<Survey> = {
    name: name.slice(0, 45),
    type,
    idCoordinator: dto.idCoordinator,
    deleted: 0 as any,
  };

  try {
    const saved = await this.surveys.save(payload as Survey);
    return { id: saved.id, name: saved.name, type: saved.type };
  } catch (e) {
    mapDuplicate(e, 'Ya existe una encuesta con ese nombre');
    throw e;
  }
}


  async replaceSurveyContentWithDuplicate(targetId: number, sourceId: number) {
    if (targetId === sourceId) throw new BadRequestException('target y source no pueden ser iguales');

    const target = await this.surveys.findOne({ where: { id: targetId, deleted: 0 as any } });
    if (!target) throw new NotFoundException('Formulario destino no encontrado/activo');

    const source = await this.surveys.findOne({ where: { id: sourceId, deleted: 0 as any } });
    if (!source) throw new NotFoundException('Formulario origen no encontrado/activo');

    const [assigned] = await this.ds.query(
      'SELECT 1 AS ok FROM `group` WHERE story = ? OR revision = ? LIMIT 1',
      [targetId, targetId],
    );
    if (assigned?.ok) {
      throw new ConflictException('El borrador está asignado a grupos; no se puede reemplazar.');
    }

    return this.ds.transaction(async (trx) => {
      await trx.getRepository(SurveySection).delete({ idSurvey: targetId } as any);

      const sections = await trx.getRepository(SurveySection).find({
        where: { idSurvey: sourceId },
        order: { order: 'ASC' as any },
      });

      for (const rel of sections) {
        await trx.query(
          'INSERT INTO surveysection (idSurvey, idSection, `order`) VALUES (?, ?, ?)',
          [targetId, rel.idSection, rel.order],
        );
      }

      return { ok: true, id: targetId };
    });
  }


  async duplicateSurvey(
    idSource: number,
    dto: { name: string; type?: number; idCoordinator: number },
  ) {
    const name = (dto?.name ?? '').trim();
    if (!name) throw new BadRequestException('name requerido');

    const src = await this.surveys.findOne({ where: { id: idSource, deleted: 0 as any } });
    if (!src) throw new NotFoundException('Formulario origen no encontrado/activo');

    const type = dto.type == null ? (src as any).type : Number(dto.type);
    if (!(type === 0 || type === 1)) {
      throw new BadRequestException('type debe ser 0 (historia) o 1 (revisión)');
    }

    if (!Number.isFinite(dto.idCoordinator) || dto.idCoordinator < 1) {
      throw new BadRequestException('idCoordinator requerido y > 0');
    }

    return this.ds.transaction(async (trx) => {
      const created = trx.getRepository(Survey).create({
        name: name.slice(0, 45),
        type: type as any,
        idCoordinator: dto.idCoordinator as any,
        deleted: 0 as any,
      });
      const saved = await trx.getRepository(Survey).save(created);

      const sections = await trx.getRepository(SurveySection).find({
        where: { idSurvey: idSource },
        order: { order: 'ASC' as any },
      });

      for (const rel of sections) {
        try {
          await trx.query(
            'INSERT INTO surveysection (idSurvey, idSection, `order`) VALUES (?, ?, ?)',
            [saved.id, rel.idSection, rel.order],
          );
        } catch (e) {
          mapDuplicate(e, 'La sección ya está vinculada al nuevo formulario');
        }
      }

      return { ok: true, id: saved.id, name: saved.name, type: saved.type };
    });
  }

private async ensureExclusiveSectionForSurvey(idSurvey: number, idSection: number): Promise<number> {
  return this.ds.transaction(async (trx) => {
    const [{ c } = { c: 0 }] = await trx.query(
      'SELECT COUNT(*) AS c FROM surveysection WHERE idSection = ?',
      [idSection],
    );
    if (Number(c ?? 0) <= 1) return idSection;

    const sec = await trx.getRepository(Section).findOne({ where: { id: idSection, deleted: 0 as any } });
    if (!sec) throw new NotFoundException('Sección no encontrada/activa');

    const clone = trx.getRepository(Section).create({
      name: sec.name,
      idCoordinator: (sec as any).idCoordinator,
      question_optional: (sec as any).question_optional,
      deleted: 0 as any,
    });
    const saved = await trx.getRepository(Section).save(clone);

    await trx.query(
      'INSERT INTO sectionquestion (idSection, idQuestion, `order`) ' +
      'SELECT ?, idQuestion, `order` FROM sectionquestion WHERE idSection = ?',
      [saved.id, idSection],
    );

    const rel = await trx.getRepository(SurveySection).findOne({ where: { idSurvey, idSection } });
    if (!rel) throw new NotFoundException('Relación survey-section no encontrada');

    await trx.getRepository(SurveySection).update(
      { idSurvey, idSection },
      { idSection: saved.id } as any,
    );

    return saved.id;
  });
}


private async ensureExclusiveQuestionForSection(
  idSection: number,
  idQuestion: number,
): Promise<number> {
  const [{ c } = { c: 0 }] = await this.ds.query(
    'SELECT COUNT(*) AS c FROM sectionquestion WHERE idQuestion = ?',
    [idQuestion],
  );
  if (Number(c ?? 0) <= 1) return idQuestion; 

  return this.ds.transaction(async (trx) => {
    const qRepo = trx.getRepository(Question);
    const qSrc = await qRepo.findOne({ where: { id: idQuestion, deleted: 0 as any } });
    if (!qSrc) throw new NotFoundException('Pregunta origen no encontrada/activa');

    let newListId: number | null = null;
    const srcListId = (qSrc as any).questionList ?? null;
    if (srcListId != null) {
      const [listRow] = await trx.query(
        'SELECT id, listname FROM questionlist WHERE id = ?',
        [srcListId],
      );
      const listname = (listRow?.listname ?? 'Lista de elementos') as string;
      const res = await trx.query(
        'INSERT INTO questionlist (listname) VALUES (?)',
        [listname],
      );
      newListId = Number(res.insertId);

      await trx.query(
        'INSERT INTO questionquestionlist (idQuestionList, idQuestion, `order`) ' +
        'SELECT ?, idQuestion, `order` FROM questionquestionlist WHERE idQuestionList = ?',
        [newListId, srcListId],
      );
    }

    const qClone = qRepo.create({
      name: (qSrc as any).name,
      idCoordinator: (qSrc as any).idCoordinator,
      questionList: newListId,    
      deleted: 0 as any,
    });
    const qSaved = await qRepo.save(qClone);

    await trx.query(
      'INSERT INTO questionresponse (idQuestion, idResponse, deleted, `order`, date_insert, date_update) ' +
      'SELECT ?, idResponse, deleted, `order`, date_insert, date_update ' +
      'FROM questionresponse WHERE idQuestion = ?',
      [qSaved.id, idQuestion],
    );

    await trx.getRepository(SectionQuestion).update(
      { idSection, idQuestion },
      { idQuestion: qSaved.id } as any,
    );

    return qSaved.id;
  });
}




  async finalizeSurvey(idSurvey: number) {
    const s = await this.surveys.findOne({ where: { id: idSurvey, deleted: 0 as any } });
    if (!s) throw new NotFoundException('Formulario no encontrado/activo');

    const [{ n } = { n: 0 }] = await this.ds.query(
      'SELECT COUNT(*) AS n FROM surveysection WHERE idSurvey = ?',
      [idSurvey],
    );
    if (Number(n ?? 0) < 1) {
      throw new BadRequestException('El formulario debe tener al menos 1 sección');
    }
    return { ok: true };
  }


  async searchSections(dto: {
    name?: string;
    idCoordinator?: number;
    page?: number;
    limit?: number;
    orderBy?: 'name' | 'date_insert' | 'id' | string;
    orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc';
  }) {
    const page  = Math.max(1, Number(dto.page ?? 1));
    const limit = Math.max(1, Math.min(Number(dto.limit ?? 20), 100));
    const offset = (page - 1) * limit;

    const sortMap: Record<string, string> = {
      name: 's.name',
      date_insert: 's.date_insert',
      id: 's.id',
    };
    const orderBy = sortMap[(dto.orderBy ?? 'date_insert').toLowerCase()] ?? 's.date_insert';
    const orderDir = normOrderDir(dto.orderDir ?? 'DESC');

    const where: string[] = ['s.deleted = 0'];
    const params: any[] = [];

    if (dto.name?.trim()) {
      where.push('s.name LIKE ?'); params.push(`%${dto.name.trim()}%`);
    }
    if (dto.idCoordinator) {
      where.push('s.idCoordinator = ?'); params.push(Number(dto.idCoordinator));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await this.sections.query(
      `SELECT COUNT(*) AS cnt FROM \`section\` s ${whereSql}`, params,
    );
    const totalItems = Number(totalRow?.[0]?.cnt ?? 0);

    const rows = await this.sections.query(
      `SELECT s.id, s.name, s.idCoordinator, s.date_insert, s.date_update
         FROM \`section\` s
        ${whereSql}
        ORDER BY ${orderBy} ${orderDir}, s.id ${orderDir}
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const meta = buildMeta({
      page, limit, totalItems,
      orderBy: Object.keys(sortMap).find(k => sortMap[k] === orderBy) ?? 'date_insert',
      orderDir,
      filters: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.idCoordinator ? { idCoordinator: Number(dto.idCoordinator) } : {}),
      },
    });

    return { data: rows, meta };
  }

  async getSectionPreview(idSection: number) {
    const [sec] = await this.sections.query(
      'SELECT id, name FROM `section` WHERE id = ? AND deleted = 0 LIMIT 1',
      [idSection],
    );
    if (!sec) throw new NotFoundException('Sección no encontrada/activa');

    const [{ n } = { n: 0 }] = await this.ds.query(
      'SELECT COUNT(*) AS n FROM sectionquestion sq ' +
      'INNER JOIN question q ON q.id = sq.idQuestion AND q.deleted = 0 ' +
      'WHERE sq.idSection = ?',
      [idSection],
    );

    return { id: sec.id, name: sec.name, questionCount: Number(n ?? 0) };
  }


async attachExistingSections(
  idSurvey: number,
  dto: { sectionIds: number[]; insertAfterOrder?: number },
) {
  if (!Array.isArray(dto.sectionIds) || dto.sectionIds.length === 0) {
    throw new BadRequestException('sectionIds requerido (array no vacío)');
  }

  const survey = await this.surveys.findOne({ where: { id: idSurvey, deleted: 0 as any } });
  if (!survey) throw new NotFoundException('Survey no encontrada/activa');

  const uniqueIds = Array.from(
    new Set(dto.sectionIds.map(Number).filter((x) => Number.isFinite(x) && x > 0)),
  );
  if (uniqueIds.length === 0) {
    throw new BadRequestException('sectionIds inválido');
  }

  return this.ds.transaction(async (trx) => {
    const placeholders = uniqueIds.map(() => '?').join(',');
    const found = await trx.query(
      `SELECT id FROM section WHERE deleted = 0 AND id IN (${placeholders})`,
      uniqueIds,
    );
    const foundIds = new Set<number>(found.map((r: any) => Number(r.id)));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new NotFoundException(`Secciones inexistentes/borrradas: ${missing.join(', ')}`);
    }

    const repoSS = trx.getRepository(SurveySection);
    const current = await repoSS.find({
      where: { idSurvey },
      order: { order: 'ASC' as any },
    });
    const currentIds = new Set(current.map((r) => r.idSection));

    const after = dto.insertAfterOrder;
    const currLen = current.length;
    const insertPos = after == null ? currLen + 1 : clamp(Number(after) + 1, 1, currLen + 1);

    await trx.query(
      'UPDATE surveysection SET `order` = `order` + ? WHERE idSurvey = ? AND `order` >= ?',
      [uniqueIds.length, idSurvey, insertPos],
    );

    const inserted: Array<{ idSection: number; order: number }> = [];
    const skipped: number[] = [];

    for (let i = 0; i < uniqueIds.length; i++) {
      const idSection = uniqueIds[i];
      if (currentIds.has(idSection)) {
        skipped.push(idSection);
        continue;
      }
      const ord = insertPos + inserted.length;
      try {
        await trx.query(
          'INSERT INTO surveysection (idSurvey, idSection, `order`) VALUES (?, ?, ?)',
          [idSurvey, idSection, ord],
        );
        inserted.push({ idSection, order: ord });
      } catch (e) {
        mapDuplicate(e, 'La sección ya está vinculada a este survey');
        skipped.push(idSection);
      }
    }

    const rows = await repoSS.find({
      where: { idSurvey },
      order: { order: 'ASC' as any },
    });
    for (let i = 0; i < rows.length; i++) {
      const desired = i + 1;
      if (rows[i].order !== desired) {
        await repoSS.update(
          { idSurvey, idSection: rows[i].idSection },
          { order: desired } as any,
        );
      }
    }

    return {
      ok: true,
      idSurvey,
      inserted,
      skipped,
      totalSections: rows.length,
    };
  });
}

  async searchQuestions(dto: {
    name?: string;
    idCoordinator?: number;
    page?: number;
    limit?: number;
    orderBy?: 'name' | 'date_insert' | 'id' | string;
    orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc';
  }) {
    const page  = Math.max(1, Number(dto.page ?? 1));
    const limit = Math.max(1, Math.min(Number(dto.limit ?? 20), 100));
    const offset = (page - 1) * limit;

    const sortMap: Record<string, string> = {
      name: 'q.name',
      date_insert: 'q.date_insert',
      id: 'q.id',
    };
    const orderBy = sortMap[(dto.orderBy ?? 'date_insert').toLowerCase()] ?? 'q.date_insert';
    const orderDir = normOrderDir(dto.orderDir ?? 'DESC');

    const where: string[] = ['q.deleted = 0'];
    const params: any[] = [];

    if (dto.name?.trim()) {
      where.push('q.name LIKE ?'); params.push(`%${dto.name.trim()}%`);
    }
    if (dto.idCoordinator) {
      where.push('q.idCoordinator = ?'); params.push(Number(dto.idCoordinator));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await this.questions.query(
      `SELECT COUNT(*) AS cnt FROM \`question\` q ${whereSql}`, params,
    );
    const totalItems = Number(totalRow?.[0]?.cnt ?? 0);

    const rows = await this.questions.query(
      `SELECT q.id, q.name, q.idCoordinator, q.date_insert, q.date_update
         FROM \`question\` q
        ${whereSql}
        ORDER BY ${orderBy} ${orderDir}, q.id ${orderDir}
        LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const meta = buildMeta({
      page, limit, totalItems,
      orderBy: Object.keys(sortMap).find(k => sortMap[k] === orderBy) ?? 'date_insert',
      orderDir,
      filters: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.idCoordinator ? { idCoordinator: Number(dto.idCoordinator) } : {}),
      },
    });

    return { data: rows, meta };
  }


async searchResponses(dto: {
  name?: string;
  type?: number | string; 
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'date_insert' | 'id' | string;
  orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc';
}) {
  const page  = Math.max(1, Number(dto.page ?? 1));
  const limit = Math.max(1, Math.min(Number(dto.limit ?? 20), 100));
  const offset = (page - 1) * limit;

  const sortMap: Record<string, string> = {
    name: 'r.name',
    date_insert: 'r.date_insert',
    id: 'r.id',
  };
  const orderBy = sortMap[(String(dto.orderBy ?? 'date_insert')).toLowerCase()] ?? 'r.date_insert';
  const orderDir = normOrderDir(String(dto.orderDir ?? 'DESC'));

  const where: string[] = ['r.deleted = 0'];
  const params: any[] = [];

  if (dto.name?.trim()) {
    where.push('r.name LIKE ?'); params.push(`%${dto.name.trim()}%`);
  }
  if (dto.type !== undefined && dto.type !== null && String(dto.type).trim() !== '') {
    const t = Number(dto.type);
    if (Number.isFinite(t)) {
      where.push('r.type = ?'); params.push(t);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await this.responses.query(
    `SELECT COUNT(*) AS cnt FROM \`response\` r ${whereSql}`, params,
  );
  const totalItems = Number(totalRow?.[0]?.cnt ?? 0);

  const rows = await this.responses.query(
    `SELECT r.id, r.name, r.type, r.unity, r.min, r.max, r.date_insert, r.date_update
       FROM \`response\` r
      ${whereSql}
      ORDER BY ${orderBy} ${orderDir}, r.id ${orderDir}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const meta = buildMeta({
    page, limit, totalItems,
    orderBy: Object.keys(sortMap).find(k => sortMap[k] === orderBy) ?? 'date_insert',
    orderDir,
    filters: {
      ...(dto.name ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: Number(dto.type) } : {}),
    },
  });

  return { data: rows, meta };
}



  async getQuestionPreview(idQuestion: number) {
    const [q] = await this.questions.query(
      'SELECT id, name FROM `question` WHERE id = ? AND deleted = 0 LIMIT 1',
      [idQuestion],
    );
    if (!q) throw new NotFoundException('Pregunta no encontrada/activa');

    const [{ n } = { n: 0 }] = await this.ds.query(
      'SELECT COUNT(*) AS n FROM questionresponse qr ' +
      'INNER JOIN response r ON r.id = qr.idResponse AND r.deleted = 0 ' +
      'WHERE qr.idQuestion = ? AND qr.deleted = 0',
      [idQuestion],
    );

    return { id: q.id, name: q.name, responseCount: Number(n ?? 0) };
  }


async getResponsePreview(idResponse: number) {
  const [r] = await this.responses.query(
    'SELECT id, name FROM `response` WHERE id = ? AND deleted = 0 LIMIT 1',
    [idResponse],
  );
  if (!r) throw new NotFoundException('Respuesta no encontrada/activa');

  const [{ n } = { n: 0 }] = await this.ds.query(
    'SELECT COUNT(*) AS n FROM questionresponse WHERE idResponse = ? AND deleted = 0',
    [idResponse],
  );

  return { id: r.id, name: r.name, usedByQuestions: Number(n ?? 0) };
}



async attachExistingQuestions(
  idSection: number,
  dto: { questionIds: number[]; insertAfterOrder?: number },
) {
  if (!Array.isArray(dto.questionIds) || dto.questionIds.length === 0) {
    throw new BadRequestException('questionIds requerido (array no vacío)');
  }

  const section = await this.sections.findOne({ where: { id: idSection, deleted: 0 as any } });
  if (!section) throw new NotFoundException('Sección no encontrada/activa');

  const uniqueIds = Array.from(new Set(
    dto.questionIds.map(Number).filter((x) => Number.isFinite(x) && x > 0),
  ));
  if (uniqueIds.length === 0) throw new BadRequestException('questionIds inválido');

  return this.ds.transaction(async (trx) => {
    const placeholders = uniqueIds.map(() => '?').join(',');

    const found = await trx.query(
      `SELECT id FROM question WHERE deleted = 0 AND id IN (${placeholders})`,
      uniqueIds,
    );
    const foundIds = new Set<number>(found.map((r: any) => Number(r.id)));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new NotFoundException(`Preguntas inexistentes/borradas: ${missing.join(', ')}`);
    }

    const rowsItems = await trx.query(
      `SELECT DISTINCT qql.idQuestion AS id
         FROM questionquestionlist qql
        WHERE qql.idQuestion IN (${placeholders})`,
      uniqueIds,
    );
    const itemsSet = new Set<number>(rowsItems.map((r: any) => Number(r.id)));

    const current = await trx.query(
      `SELECT idQuestion, \`order\`
         FROM sectionquestion
        WHERE idSection = ?
        ORDER BY \`order\`, idQuestion
        FOR UPDATE`,
      [idSection],
    );
    const currentIds = new Set<number>(current.map((r: any) => Number(r.idQuestion)));

    const allowed = uniqueIds.filter((id) => !itemsSet.has(id) && !currentIds.has(id));
    const skippedItems = uniqueIds.filter((id) => itemsSet.has(id));
    const skippedDup   = uniqueIds.filter((id) => currentIds.has(id));

    if (allowed.length === 0) {
      return {
        ok: true,
        idSection,
        inserted: [],
        skippedItems,
        skippedDup,
        totalQuestions: current.length,
      };
    }

    const currLen   = current.length;
    const after     = dto.insertAfterOrder;
    const insertPos = after == null
      ? currLen + 1
      : Math.max(1, Math.min(Number(after) + 1, currLen + 1));

    {
      const values: any[] = [];
      let ord = insertPos;
      for (const qid of allowed) {
        values.push(idSection, qid, ord++);
      }
      const tuples = allowed.map(() => '(?,?,?)').join(',');
      await trx.query(
        `INSERT INTO sectionquestion (idSection, idQuestion, \`order\`)
         VALUES ${tuples}`,
        values,
      );
    }

 
    await trx.query('SET @rn := 0');
    await trx.query(
      `UPDATE sectionquestion sq
          JOIN (
                SELECT x.idQuestion, (@rn := @rn + 1) AS new_order
                  FROM (
                        SELECT idQuestion, \`order\`
                          FROM sectionquestion
                         WHERE idSection = ?
                         ORDER BY \`order\`, idQuestion
                       ) AS x
               ) t
            ON t.idQuestion = sq.idQuestion
         SET sq.\`order\` = t.new_order
       WHERE sq.idSection = ?`,
      [idSection, idSection],
    );

    const rowsAfter = await trx.query(
      `SELECT COUNT(*) AS cnt FROM sectionquestion WHERE idSection = ?`,
      [idSection],
    );

    return {
      ok: true,
      idSection,
      inserted: allowed.map((idQuestion) => ({ idQuestion })),
      skippedItems,
      skippedDup,
      totalQuestions: Number(rowsAfter[0].cnt),
    };
  });
}





async attachExistingResponses(
  idQuestion: number,
  dto: { responseIds: number[]; insertAfterOrder?: number },
) {
  if (!Array.isArray(dto.responseIds) || dto.responseIds.length === 0) {
    throw new BadRequestException('responseIds requerido (array no vacío)');
  }

  await this.assertNotItemQuestion(idQuestion);

  const q = await this.questions.findOne({ where: { id: idQuestion, deleted: 0 as any } });
  if (!q) throw new NotFoundException('Pregunta no encontrada/activa');

  const uniqueIds = Array.from(new Set(dto.responseIds.map(Number).filter((x) => Number.isFinite(x) && x > 0)));
  if (uniqueIds.length === 0) throw new BadRequestException('responseIds inválido');

  return this.ds.transaction(async (trx) => {
    const placeholders = uniqueIds.map(() => '?').join(',');
    const found = await trx.query(
      `SELECT id FROM response WHERE deleted = 0 AND id IN (${placeholders})`,
      uniqueIds,
    );
    const foundIds = new Set<number>(found.map((r: any) => Number(r.id)));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new NotFoundException(`Respuestas inexistentes/borradas: ${missing.join(', ')}`);
    }

    const repoQR = trx.getRepository(QuestionResponse);
    const currentActive = await trx.query(
      `SELECT idResponse, \`order\`
         FROM questionresponse
        WHERE idQuestion = ? AND deleted = 0
        ORDER BY \`order\` ASC`,
      [idQuestion],
    );
    const currentActiveIds = new Set<number>(currentActive.map((r: any) => Number(r.idResponse)));

    const after = dto.insertAfterOrder;
    const currLen = currentActive.length;
    const insertPos = after == null ? currLen + 1 : clamp(Number(after) + 1, 1, currLen + 1);

    const willInsert = uniqueIds.filter((id) => !currentActiveIds.has(id));
    if (willInsert.length > 0) {
      await trx.query(
        'UPDATE questionresponse SET `order` = `order` + ? WHERE idQuestion = ? AND deleted = 0 AND `order` >= ?',
        [willInsert.length, idQuestion, insertPos],
      );
    }

    let nextOrder = insertPos;
    for (const idResponse of uniqueIds) {
      if (currentActiveIds.has(idResponse)) continue;

      const existing = await repoQR.findOne({ where: { idQuestion, idResponse } as any });
      if (!existing) {
        await trx.query(
          `INSERT INTO questionresponse (idQuestion, idResponse, deleted, \`order\`)
           VALUES (?, ?, 0, ?)`,
          [idQuestion, idResponse, nextOrder],
        );
      } else {
        await trx.query(
          `UPDATE questionresponse
              SET deleted = 0, \`order\` = ?, date_update = NOW()
            WHERE idQuestion = ? AND idResponse = ?`,
          [nextOrder, idQuestion, idResponse],
        );
      }
      nextOrder++;
    }

    const listId = (q as any).questionList ?? null;
    if (listId != null) {
      const items: Array<{ idQuestion: number }> = await trx.query(
        'SELECT idQuestion FROM questionquestionlist WHERE idQuestionList = ? ORDER BY `order` ASC',
        [listId],
      );

      for (const idResp of uniqueIds) {
        for (const it of items) {
          const [e2] = await trx.query(
            'SELECT 1 AS ok FROM questionresponse WHERE idQuestion = ? AND idResponse = ?',
            [it.idQuestion, idResp],
          );
          if (!e2) {
            const [{ c: ci } = { c: 0 }] = await trx.query(
              'SELECT COUNT(*) AS c FROM questionresponse WHERE idQuestion = ? AND deleted = 0',
              [it.idQuestion],
            );
            const pos = Number(ci ?? 0) + 1;
            await trx.query(
              'INSERT INTO questionresponse (idQuestion, idResponse, deleted, `order`) VALUES (?, ?, 0, ?)',
              [it.idQuestion, idResp, pos],
            );
          }
        }
      }
    }

    const rows = await repoQR.find({
      where: { idQuestion, deleted: 0 as any },
      order: { order: 'ASC' as any },
    });
    for (let i = 0; i < rows.length; i++) {
      const desired = i + 1;
      if ((rows[i] as any).order !== desired) {
        await repoQR.update(
          { idQuestion: (rows[i] as any).idQuestion, idResponse: (rows[i] as any).idResponse } as any,
          { order: desired } as any,
        );
      }
    }

    return {
      ok: true,
      idQuestion,
      inserted: [],        
      reactivated: [],
      skippedActive: [],
      totalResponses: rows.length,
    };
  });
}


private async isItemQuestion(idQuestion: number): Promise<boolean> {
  const [row] = await this.ds.query(
    'SELECT 1 AS ok FROM questionquestionlist WHERE idQuestion = ? LIMIT 1',
    [idQuestion],
  );
  return !!row?.ok;
}


private async assertNotItemQuestion(idQuestion: number): Promise<void> {
  if (await this.isItemQuestion(idQuestion)) {
    throw new ConflictException(
      'La pregunta es un ítem de una questionList y no puede usarse como pregunta independiente de sección ni recibir respuestas directamente.',
    );
  }
}

}
