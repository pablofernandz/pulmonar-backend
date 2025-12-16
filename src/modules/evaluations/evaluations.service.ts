import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Evaluation } from './evaluation.entity';
import { EvaluationAnswer } from './evaluation-answer.entity';
import { CreateEvaluationDto } from './dtos/create-evaluation.dto';
import { SaveAnswersDto } from './dtos/save-answers.dto';
import { Paciente } from '../pacientes/paciente.entity';
import { Survey } from '../surveys/survey.entity';
import { Question } from '../surveys/question.entity';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation) private evalRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationAnswer) private ansRepo: Repository<EvaluationAnswer>,
    @InjectRepository(Paciente) private patientRepo: Repository<Paciente>,
    @InjectRepository(Survey) private surveyRepo: Repository<Survey>,
    @InjectRepository(Question) private questionRepo: Repository<Question>,
    private readonly ds: DataSource,
  ) {}

  // ----------------------- Funciones auxiliares -----------------------

  private async isActive(table: 'patient' | 'revisor' | 'survey', id: number) {
    const [row] = await this.ds.query(
      `SELECT 1 AS ok FROM \`${table}\` WHERE id = ? AND deleted = 0 LIMIT 1`,
      [id],
    );
    return !!row;
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

  private async getSubmitColumns() {
    const haveSubmitted = await this.hasColumn('evaluation', 'submitted');
    const haveDateSubmit = await this.hasColumn('evaluation', 'date_submit');
    return { haveSubmitted, haveDateSubmit };
  }

  private async hasColumn(table: string, col: string) {
    const rows = await this.ds.query(
      `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
      [col],
    );
    return rows?.length > 0;
  }

  private async isEvaluationSubmitted(idEvaluation: number): Promise<boolean> {
    const { haveSubmitted, haveDateSubmit } = await this.getSubmitColumns();
    if (!haveSubmitted && !haveDateSubmit) return false;

    if (haveSubmitted && haveDateSubmit) {
      const [r] = await this.ds.query(
        'SELECT submitted, date_submit FROM `evaluation` WHERE id = ? LIMIT 1',
        [idEvaluation],
      );
      if (!r) return false;
      return Number(r.submitted) === 1 || (r.date_submit != null);
    }

    if (haveSubmitted) {
      const [r] = await this.ds.query(
        'SELECT submitted FROM `evaluation` WHERE id = ? LIMIT 1',
        [idEvaluation],
      );
      return !!r && Number(r.submitted) === 1;
    }

    const [r] = await this.ds.query(
      'SELECT date_submit FROM `evaluation` WHERE id = ? LIMIT 1',
      [idEvaluation],
    );
    return !!r && r.date_submit != null;
  }

  private async markSubmitted(idEvaluation: number) {
    const { haveSubmitted, haveDateSubmit } = await this.getSubmitColumns();
    if (!haveSubmitted && !haveDateSubmit) return;

    if (haveSubmitted && haveDateSubmit) {
      await this.ds.query(
        'UPDATE `evaluation` SET submitted = 1, date_submit = NOW(), date_update = NOW() WHERE id = ?',
        [idEvaluation],
      );
      return;
    }
    if (haveSubmitted) {
      await this.ds.query(
        'UPDATE `evaluation` SET submitted = 1, date_update = NOW() WHERE id = ?',
        [idEvaluation],
      );
      return;
    }

    await this.ds.query(
      'UPDATE `evaluation` SET date_submit = NOW(), date_update = NOW() WHERE id = ?',
      [idEvaluation],
    );
  }


  private async checkQuestionAllowedInSection(
    idSection: number,
    idQuestion: number,
  ): Promise<
    | { kind: 'direct'; ownerQuestionId: number; itemQuestionId: null; listId: null }
    | { kind: 'item'; ownerQuestionId: number; itemQuestionId: number; listId: number }
    | null
  > {
    // Pregunta normal
    const [direct] = await this.ds.query(
      'SELECT 1 AS ok FROM sectionquestion WHERE idSection = ? AND idQuestion = ? LIMIT 1',
      [idSection, idQuestion],
    );
    if (direct?.ok) {
      return {
        kind: 'direct',
        ownerQuestionId: idQuestion,
        itemQuestionId: null,
        listId: null,
      };
    }

    // Pregunta con ítems
    const [it] = await this.ds.query(
      'SELECT idQuestionList AS listId FROM questionquestionlist WHERE idQuestion = ? LIMIT 1',
      [idQuestion],
    );
    if (!it?.listId) return null;

    const [owner] = await this.ds.query(
      'SELECT id FROM question WHERE questionList = ? AND deleted = 0 LIMIT 1',
      [it.listId],
    );
    if (!owner?.id) return null;

    const [ownerInSec] = await this.ds.query(
      'SELECT 1 AS ok FROM sectionquestion WHERE idSection = ? AND idQuestion = ? LIMIT 1',
      [idSection, owner.id],
    );
    if (!ownerInSec?.ok) return null;

    return {
      kind: 'item',
      ownerQuestionId: Number(owner.id),
      itemQuestionId: idQuestion,
      listId: Number(it.listId),
    };
  }

  private async ensureQuestionAllowedInSectionOrThrow(
    idSection: number,
    idQuestion: number,
  ) {
    const allowed = await this.checkQuestionAllowedInSection(idSection, idQuestion);
    if (!allowed) {
      throw new BadRequestException(
        `La pregunta ${idQuestion} no pertenece a la sección ${idSection}`,
      );
    }
    return allowed;
  }

  async create(dto: CreateEvaluationDto, currentUser: { id: number; roles: any }) {
    if (!currentUser?.roles?.coordinator && !currentUser?.roles?.revisor) {
      throw new ForbiddenException();
    }

    const patient = await this.patientRepo.findOne({
      where: { id: dto.idPatient, deleted: 0 },
    });
    if (!patient) throw new NotFoundException('Paciente no encontrado/activo');

    const survey = await this.surveyRepo.findOne({
      where: { id: dto.idSurvey, deleted: 0 },
    });
    if (!survey) throw new NotFoundException('Encuesta no encontrada/activa');

    const idRevisor =
      currentUser.roles?.revisor && !currentUser.roles?.coordinator
        ? currentUser.id
        : (dto as any).idRevisor ?? currentUser.id;

    if (dto.idPatient === idRevisor) {
      throw new ForbiddenException(
        'Un revisor no puede evaluarse a sí mismo como paciente',
      );
    }

    if (!(await this.isActive('revisor', idRevisor))) {
      throw new BadRequestException('Revisor inválido o inactivo');
    }

    if (!(await this.shareActiveGroup(dto.idPatient, idRevisor))) {
      throw new ForbiddenException(
        'Paciente y revisor no comparten grupo activo',
      );
    }

    const created = this.evalRepo.create({
      survey: { id: dto.idSurvey } as any,
      patient: { id: dto.idPatient } as any,
      revisor: { id: idRevisor } as any,
      date: (dto as any).date ? new Date((dto as any).date) : new Date(),
      deleted: 0,
    });

    return this.evalRepo.save(created);
  }

  async saveAnswers(
    idEvaluation: number,
    dto: SaveAnswersDto,
    currentUser: { id: number; roles: any },
  ) {
    if (!currentUser?.roles?.coordinator && !currentUser?.roles?.revisor) {
      throw new ForbiddenException();
    }

    const evaluation = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['patient', 'revisor', 'survey'],
    });
    if (!evaluation || (evaluation as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    if (currentUser.roles?.revisor && !currentUser.roles?.coordinator) {
      if (evaluation.revisor?.id !== currentUser.id) {
        throw new ForbiddenException('No puedes modificar esta evaluación');
      }
    }

    if (await this.isEvaluationSubmitted(idEvaluation)) {
      throw new ForbiddenException(
        'La evaluación ya está enviada y no se puede editar',
      );
    }

    if (!dto.answers?.length) return { updated: 0 };

    const qIds = [...new Set(dto.answers.map((a) => a.idQuestion))];
    const questions = await this.questionRepo.find({ where: { id: In(qIds) } });
    if (questions.length !== qIds.length) {
      const ok = new Set(questions.map((q) => q.id));
      const missing = qIds.filter((id) => !ok.has(id));
      throw new BadRequestException(
        `Preguntas inexistentes: ${missing.join(', ')}`,
      );
    }

    const surveyId = evaluation.survey.id;

    const secRows = await this.ds.query(
      'SELECT idSection FROM surveysection WHERE idSurvey = ?',
      [surveyId],
    );
    const validSections = new Set<number>(
      secRows.map((r: any) => Number(r.idSection)),
    );

    const qrRows = await this.ds.query(
      'SELECT idQuestion, idResponse FROM questionresponse WHERE deleted = 0',
    );
    const validQR = new Set<string>(
      qrRows.map((r: any) => `${r.idQuestion}:${r.idResponse}`),
    );

    type Row = {
      idSection: number;
      idQuestion: number;
      idResponse: number;
      idQuestionList: number | null;
      value: string | null;
    };
    const rows: Row[] = [];

    for (const a of dto.answers) {
      const idSection = Number(a.idSection);
      const idQuestion = Number(a.idQuestion);
      const idResponse = Number(a.idResponse);
      const rawIdQuestionList =
        a.idQuestionList == null ? null : Number(a.idQuestionList);
      const value = a.value == null ? null : String(a.value);

      if (
        !Number.isFinite(idSection) ||
        !Number.isFinite(idQuestion) ||
        !Number.isFinite(idResponse)
      ) {
        throw new BadRequestException(
          'idSection, idQuestion e idResponse deben ser numéricos',
        );
      }
      if (!validSections.has(idSection)) {
        throw new BadRequestException(
          `La sección ${idSection} no pertenece a la encuesta`,
        );
      }

      const allowed = await this.ensureQuestionAllowedInSectionOrThrow(
        idSection,
        idQuestion,
      );

      let idQuestionList: number | null = null;
      if (allowed.kind === 'direct') {
        if (rawIdQuestionList != null) {
          throw new BadRequestException(
            `La pregunta ${idQuestion} no pertenece a ninguna lista`,
          );
        }
        idQuestionList = null;
      } else {
        idQuestionList = allowed.listId;
        if (
          rawIdQuestionList != null &&
          rawIdQuestionList !== idQuestionList
        ) {
          throw new BadRequestException(
            `La pregunta ${idQuestion} pertenece a la lista ${idQuestionList}, no a ${rawIdQuestionList}`,
          );
        }
      }

      if (!validQR.has(`${idQuestion}:${idResponse}`)) {
        throw new BadRequestException(
          `La respuesta ${idResponse} no está asociada a la pregunta ${idQuestion}`,
        );
      }

      rows.push({
        idSection,
        idQuestion,
        idResponse,
        idQuestionList,
        value,
      });
    }

    await this.ds.query(
      `
    UPDATE evaluation_question eq
    LEFT JOIN surveysection ss
           ON ss.idSurvey = ? AND ss.idSection = eq.idSection

    /* directa: pregunta enlazada a la sección */
    LEFT JOIN sectionquestion sq_direct
           ON sq_direct.idSection = eq.idSection AND sq_direct.idQuestion = eq.idQuestion

    /* si es ítem: localiza propietaria de la lista */
    LEFT JOIN question q_owner
           ON (eq.idQuestionList IS NOT NULL AND q_owner.questionList = eq.idQuestionList AND q_owner.deleted = 0)

    /* verifica que la propietaria esté en la sección */
    LEFT JOIN sectionquestion sq_owner
           ON (eq.idQuestionList IS NOT NULL AND sq_owner.idSection = eq.idSection AND sq_owner.idQuestion = q_owner.id)

    /* respuesta válida para esa pregunta */
    LEFT JOIN questionresponse qr
           ON qr.idQuestion = eq.idQuestion AND qr.idResponse = eq.idResponse AND qr.deleted = 0

    SET eq.deleted = 1, eq.date_update = NOW()
    WHERE eq.idEvaluation = ?
      AND eq.deleted = 0
      AND (
        ss.idSection IS NULL -- sección ya no pertenece a la encuesta
        OR qr.idResponse IS NULL -- respuesta ya no pertenece a la pregunta
        OR (
             /* si es pregunta normal, debe existir el enlace directo */
             (eq.idQuestionList IS NULL AND sq_direct.idQuestion IS NULL)
             /* si es ítem, debe existir propietaria y su enlace en la sección */
             OR (eq.idQuestionList IS NOT NULL AND (q_owner.id IS NULL OR sq_owner.idQuestion IS NULL))
           )
      )
    `,
      [surveyId, idEvaluation],
    );

    type Key = {
      idSection: number;
      idQuestion: number;
      idQuestionList: number | null;
      idResponse: number;
    };
    const K = (r: Key) =>
      `${r.idSection}:${r.idQuestion}:${r.idQuestionList ?? 'NULL'}:${
        r.idResponse
      }`;

    const incomingBySec = new Map<number, Set<string>>();
    for (const r of rows) {
      const set = incomingBySec.get(r.idSection) ?? new Set<string>();
      set.add(K(r));
      incomingBySec.set(r.idSection, set);
    }

    for (const [idSection, incoming] of incomingBySec.entries()) {
      const existing: Array<{
        idSection: number;
        idQuestion: number;
        idQuestionList: number | null;
        idResponse: number;
      }> = await this.ds.query(
        `SELECT idSection, idQuestion, idQuestionList, idResponse
         FROM evaluation_question
        WHERE idEvaluation = ? AND idSection = ? AND deleted = 0`,
        [idEvaluation, idSection],
      );

      const toDelete = existing.filter((r) => !incoming.has(K(r)));
      for (const r of toDelete) {
        const sql = `
        UPDATE evaluation_question
           SET deleted = 1, date_update = NOW()
         WHERE idEvaluation = ?
           AND idSection    = ?
           AND idQuestion   = ?
           AND idResponse   = ?
           AND ${
             r.idQuestionList != null
               ? 'idQuestionList = ?'
               : 'idQuestionList IS NULL'
           }
           AND deleted = 0
      `;
        const params =
          r.idQuestionList != null
            ? [
                idEvaluation,
                r.idSection,
                r.idQuestion,
                r.idResponse,
                r.idQuestionList,
              ]
            : [idEvaluation, r.idSection, r.idQuestion, r.idResponse];
        await this.ds.query(sql, params);
      }
    }

    const placeholders = rows
      .map(() => '(?, ?, ?, ?, ?, ?, NOW(), NOW())')
      .join(', ');
    const params: any[] = [];
    for (const r of rows) {
      params.push(
        idEvaluation,
        r.idSection,
        r.idQuestionList,
        r.idQuestion,
        r.idResponse,
        r.value,
      );
    }

    await this.ds.query(
      `INSERT INTO evaluation_question
       (idEvaluation, idSection, idQuestionList, idQuestion, idResponse, value, date_insert, date_update)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       value = VALUES(value),
       deleted = 0,
       date_update = NOW()`,
      params,
    );

    return { updated: rows.length };
  }

  async submit(idEvaluation: number, currentUser: { id: number; roles: any }) {
    if (!currentUser?.roles?.coordinator && !currentUser?.roles?.revisor) {
      throw new ForbiddenException();
    }

    const evaluation = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['revisor'],
    });
    if (!evaluation || (evaluation as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    if (currentUser.roles?.revisor && !currentUser.roles?.coordinator) {
      if (evaluation.revisor?.id !== currentUser.id) {
        throw new ForbiddenException('No puedes enviar esta evaluación');
      }
    }

    if (await this.isEvaluationSubmitted(idEvaluation)) {
      return { ok: true, alreadySubmitted: true };
    }

    await this.markSubmitted(idEvaluation);
    return { ok: true };
  }

  async getIfStaffAllowed(
    idEvaluation: number,
    currentUser: { id: number; roles: any },
  ) {
    const ev = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['patient', 'revisor', 'survey'],
    });
    if (!ev || (ev as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    if (currentUser.roles?.coordinator) return this.get(idEvaluation);

    if (currentUser.roles?.revisor) {
      if (ev.revisor?.id !== currentUser.id) throw new ForbiddenException();
      return this.get(idEvaluation);
    }

    throw new ForbiddenException();
  }

  async get(idEvaluation: number) {
    const evaluation = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['patient', 'revisor', 'survey'],
    });
    if (!evaluation || (evaluation as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    const survey = await this.surveyRepo.findOne({
      where: { id: evaluation.survey.id },
    });
    if (!survey) throw new NotFoundException('Encuesta no encontrada');

    let tutorName: string | null = null;
    try {
      const [rev] = await this.ds.query(
        'SELECT name, last_name_1, last_name_2 FROM `user` WHERE id = ? LIMIT 1',
        [evaluation.revisor.id],
      );
      if (rev) {
        const parts = [rev.name, rev.last_name_1, rev.last_name_2]
          .map((s: any) => (s ? String(s).trim() : ''))
          .filter((s: string) => s.length > 0);
        tutorName = parts.join(' ') || null;
      }
    } catch {
    }

    const surveyType: number | null =
      (survey as any)?.type != null ? Number((survey as any).type) : null;

    const rows = await this.ds.query(
      `
    SELECT
      a.idSection                         AS idSection,
      s.name                              AS sectionTitle,
      COALESCE(q_owner.id, q.id)          AS ownerQuestionId,
      COALESCE(q_owner.name, q.name)      AS ownerQuestionName,
      a.idQuestion                        AS itemQuestionId,
      a.idResponse                        AS idResponse,
      a.idQuestionList                    AS idQuestionList,
      a.value                             AS value,
      a.date_update                       AS date_update
    FROM evaluation_question a
    LEFT JOIN section  s      ON s.id = a.idSection
    LEFT JOIN question q      ON q.id = a.idQuestion
    LEFT JOIN question q_owner
           ON q_owner.questionList = a.idQuestionList
          AND q_owner.deleted = 0
    WHERE a.idEvaluation = ?
      AND a.deleted = 0
    ORDER BY a.idSection,
             ownerQuestionId,
             a.date_update DESC
    `,
      [idEvaluation],
    );

    const secMap = new Map<
      number,
      {
        id: number;
        title: string | null;
        questions: Map<
          number,
          {
            id: number;
            name: string | null;
            answers: Array<{
              idItem: number | null;
              idResponse: number | null;
              idQuestionList: number | null;
              value: string | null;
            }>;
          }
        >;
      }
    >();

    for (const r of rows as any[]) {
      const sectionId = Number(r.idSection);
      const sectionTitle = r.sectionTitle ?? null;
      const ownerQuestionId = Number(r.ownerQuestionId);
      const ownerQuestionName = r.ownerQuestionName ?? null;
      const itemQuestionId =
        r.itemQuestionId != null ? Number(r.itemQuestionId) : null;

      if (!secMap.has(sectionId)) {
        secMap.set(sectionId, {
          id: sectionId,
          title: sectionTitle,
          questions: new Map(),
        });
      }
      const sec = secMap.get(sectionId)!;

      if (!sec.questions.has(ownerQuestionId)) {
        sec.questions.set(ownerQuestionId, {
          id: ownerQuestionId,
          name: ownerQuestionName,
          answers: [],
        });
      }
      const q = sec.questions.get(ownerQuestionId)!;

      const answer = {
        idItem: itemQuestionId,
        idResponse: r.idResponse != null ? Number(r.idResponse) : null,
        idQuestionList:
          r.idQuestionList != null ? Number(r.idQuestionList) : null,
        value: r.value ?? null,
      };

      q.answers.push(answer);
    }

    const submitted = await this.isEvaluationSubmitted(idEvaluation);

    const sections = Array.from(secMap.values()).map((sec) => ({
      id: sec.id,
      title: sec.title,
      questions: Array.from(sec.questions.values()).map((q) => ({
        id: q.id,
        name: q.name,
        answer: q.answers[0] ?? null,
        answers: q.answers,
      })),
    }));

    return {
      surveyName: (survey as any).name ?? null,
      surveyType,
      tutorName,

      evaluation: {
        id: evaluation.id,
        idPatient: evaluation.patient.id,
        idSurvey: evaluation.survey.id,
        idRevisor: evaluation.revisor.id,
        date: evaluation.date,
        createdAt: (evaluation as any).date_insert,
        updatedAt: (evaluation as any).date_update,
        status: submitted ? 'submitted' : 'open',
      },
      survey: {
        id: survey.id,
        name: (survey as any).name ?? null,
        ...(surveyType != null ? { type: surveyType } : {}),
      },
      sections,
    };
  }

  async listByPatient(idPatient: number) {
    return this.evalRepo
      .createQueryBuilder('e')
      .where('e.idPatient = :id', { id: idPatient })
      .andWhere('e.deleted = 0')
      .orderBy('e.date', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .getMany();
  }

  async listByRevisor(idRevisor: number) {
    return this.evalRepo
      .createQueryBuilder('e')
      .where('e.idRevisor = :id', { id: idRevisor })
      .andWhere('e.deleted = 0')
      .orderBy('e.date', 'DESC')
      .addOrderBy('e.id', 'DESC')
      .getMany();
  }

  async search(filters: {
    patientId?: number;
    revisorId?: number;
    surveyId?: number;
  }) {
    const where: string[] = ['e.deleted = 0'];
    const params: any[] = [];
    if (filters.patientId) {
      where.push('e.idPatient = ?');
      params.push(filters.patientId);
    }
    if (filters.revisorId) {
      where.push('e.idRevisor = ?');
      params.push(filters.revisorId);
    }
    if (filters.surveyId) {
      where.push('e.idSurvey  = ?');
      params.push(filters.surveyId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    return this.ds.query(
      `SELECT e.id, e.date, e.idPatient, e.idRevisor, e.idSurvey,
              s.name AS surveyName
         FROM evaluation e
         INNER JOIN survey s ON s.id = e.idSurvey
       ${whereSql}
       ORDER BY e.date DESC, e.id DESC`,
      params,
    );
  }

  async getIfOwned(idEvaluation: number, patientId: number) {
    const ev = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['patient'],
    });
    if (!ev || (ev as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }
    if (ev.patient.id !== patientId) throw new ForbiddenException();
    return this.get(idEvaluation);
  }

  async exportCsvForUser(idEvaluation: number, user: { id: number; roles: any }) {
    const ev = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['patient', 'revisor'],
    });
    if (!ev || (ev as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }

    const isCoordinator = !!user.roles?.coordinator;
    const isRevisor = !!user.roles?.revisor;
    const isPatient = !!user.roles?.patient;

    if (isCoordinator) {
      // ok
    } else if (isRevisor) {
      if (ev.revisor?.id !== user.id) throw new ForbiddenException();
    } else if (isPatient) {
      if (ev.patient?.id !== user.id) throw new ForbiddenException();
    } else {
      throw new ForbiddenException();
    }

    const detail = await this.get(idEvaluation);

    const lines: string[] = [];
    lines.push(
      ['Sección', 'IdPregunta', 'Pregunta', 'IdRespuesta', 'Respuesta'].join(
        ';',
      ),
    );

    for (const s of detail.sections) {
      for (const q of s.questions) {
        const ans =
          q.answer?.value != null
            ? String(q.answer.value).replace(/\r?\n/g, ' ')
            : '';
        const row = [
          s.title ?? '',
          q.id,
          String(q.name ?? '').replace(/[\r\n;]+/g, ' '),
          q.answer?.idResponse ?? '',
          ans.replace(/[\r\n;]+/g, ' '),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        lines.push(row.join(';'));
      }
    }
    return '\uFEFF' + lines.join('\n');
  }

  async exportCsvIfAllowed(
    idEvaluation: number,
    who: { id: number; isStaff: boolean },
  ) {
    const ev = await this.evalRepo.findOne({
      where: { id: idEvaluation },
      relations: ['patient'],
    });
    if (!ev || (ev as any).deleted === 1) {
      throw new NotFoundException('Evaluación no encontrada');
    }
    if (!who.isStaff && ev.patient.id !== who.id) {
      throw new ForbiddenException();
    }

    const detail = await this.get(idEvaluation);

    const lines: string[] = [];
    lines.push(
      ['Sección', 'IdPregunta', 'Pregunta', 'IdRespuesta', 'Respuesta'].join(
        ';',
      ),
    );

    for (const s of detail.sections) {
      for (const q of s.questions) {
        const ans =
          q.answer?.value != null
            ? String(q.answer.value).replace(/\r?\n/g, ' ')
            : '';
        const row = [
          s.title ?? '',
          q.id,
          String(q.name ?? '').replace(/[\r\n;]+/g, ' '),
          q.answer?.idResponse ?? '',
          ans.replace(/[\r\n;]+/g, ' '),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        lines.push(row.join(';'));
      }
    }
    return '\uFEFF' + lines.join('\n');
  }
}
