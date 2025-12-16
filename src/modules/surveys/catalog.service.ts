import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CatalogService {
  constructor(private readonly ds: DataSource) {}


  async listQuestions() {
    return this.ds.query(
      `SELECT
         q.id,
         q.name                    AS qName,
         q.date_update             AS qUpdated,
         u.name                    AS uName,
         u.last_name_1             AS uLastName1,
         u.last_name_2             AS uLastName2,
         s.name                    AS sectionName
       FROM question q
       INNER JOIN user u ON q.idCoordinator = u.id
       INNER JOIN sectionquestion sq ON sq.idQuestion = q.id
       INNER JOIN section s ON s.id = sq.idSection
       WHERE q.id NOT IN (SELECT qql.idQuestion FROM questionquestionlist qql)
       ORDER BY q.name, q.date_update DESC`
    );
  }

  async listResponses() {
    return this.ds.query(
      `SELECT
         r.id,
         r.name,
         u.name         AS uName,
         u.last_name_1  AS uLastName1,
         u.last_name_2  AS uLastName2,
         r.date_update  AS rUpdated
       FROM response r
       INNER JOIN user u ON r.idCoordinator = u.id
       ORDER BY r.name, r.date_update DESC`
    );
  }

  async listQuestionLists() {
    return this.ds.query(
      `SELECT
         id,
         listname,
         date_insert
       FROM questionlist`
    );
  }

  async listQuestionsOfList(idQuestionList: number) {
    const rows = await this.ds.query(
      `SELECT
         q.id,
         q.name,
         qql.\`order\`,
         ql.listname
       FROM question q
       INNER JOIN questionquestionlist qql
               ON qql.idQuestion = q.id AND qql.idQuestionList = ?
       INNER JOIN questionlist ql
               ON ql.id = qql.idQuestionList
       WHERE q.deleted = 0`,
      [idQuestionList],
    );
    if (!rows.length) {
      throw new NotFoundException('No hay items para esa lista');
    }
    return { items: rows };
  }


  async getQuestionExtended(id: number) {
    const [q] = await this.ds.query(
      `SELECT
         q.id,
         q.name,
         q.questionList       AS idQuestionList,
         ql.listname          AS listname
       FROM question q
       LEFT JOIN questionlist ql ON ql.id = q.questionList
       WHERE q.id = ? AND q.deleted = 0`,
      [id],
    );
    if (!q) throw new NotFoundException('Pregunta no encontrada');

    const responses = await this.ds.query(
      `SELECT
         r.id,
         r.name,
         r.type,
         r.min,
         r.max,
         r.unity,
         qr.\`order\`
       FROM response r
       INNER JOIN questionresponse qr ON qr.idResponse = r.id
       WHERE r.deleted = 0 AND qr.idQuestion = ?
       ORDER BY qr.\`order\` ASC, r.name ASC`,
      [id],
    );

    let items: any[] = [];
    if (q.idQuestionList) {
      items = await this.ds.query(
        `SELECT
           qq.id,
           qq.name,
           qql.\`order\`
         FROM question qq
         INNER JOIN questionquestionlist qql
                 ON qql.idQuestion = qq.id
         WHERE qq.deleted = 0
           AND qql.idQuestionList = ?`,
        [q.idQuestionList],
      );
    }

    return {
      id: q.id,
      name: q.name,
      questionList: q.idQuestionList
        ? { id: q.idQuestionList, listname: q.listname }
        : null,
      responses,
      items,
    };
  }

  async getQuestionsExtended(ids: number[]) {
    if (!ids.length) throw new BadRequestException('ids requerido');
    const base = await this.ds.query(
      `SELECT
         q.id,
         q.name,
         q.questionList       AS idQuestionList,
         ql.listname          AS listname
       FROM question q
       LEFT JOIN questionlist ql ON ql.id = q.questionList
       WHERE q.id IN (${ids.map(() => '?').join(',')}) AND q.deleted = 0`,
      ids,
    );
    if (!base.length) return [];

    const allResp = await this.ds.query(
      `SELECT
         qr.idQuestion,
         r.id,
         r.name,
         r.type,
         r.min,
         r.max,
         r.unity,
         qr.\`order\`
       FROM response r
       INNER JOIN questionresponse qr ON qr.idResponse = r.id
       WHERE r.deleted = 0 AND qr.idQuestion IN (${ids.map(() => '?').join(',')})
       ORDER BY qr.idQuestion, qr.\`order\`, r.name`,
      ids,
    );

    const lists = [...new Set(base.map((b: any) => b.idQuestionList).filter(Boolean))];
    const itemsByList = new Map<number, any[]>();
    if (lists.length) {
      const rows = await this.ds.query(
        `SELECT
           qql.idQuestionList,
           qq.id,
           qq.name,
           qql.\`order\`
         FROM question qq
         INNER JOIN questionquestionlist qql ON qql.idQuestion = qq.id
         WHERE qq.deleted = 0
           AND qql.idQuestionList IN (${lists.map(() => '?').join(',')})`,
        lists,
      );
      for (const row of rows) {
        if (!itemsByList.has(row.idQuestionList)) itemsByList.set(row.idQuestionList, []);
        itemsByList.get(row.idQuestionList)!.push({
          id: row.id,
          name: row.name,
          order: row.order,
        });
      }
    }

    return base.map((q: any) => ({
      id: q.id,
      name: q.name,
      questionList: q.idQuestionList ? { id: q.idQuestionList, listname: q.listname } : null,
      responses: allResp.filter((r: any) => r.idQuestion === q.id)
                        .map((r: any) => ({ id: r.id, name: r.name, type: r.type, min: r.min, max: r.max, unity: r.unity, order: r.order })),
      items: q.idQuestionList ? (itemsByList.get(q.idQuestionList) ?? []) : [],
    }));
  }
}
