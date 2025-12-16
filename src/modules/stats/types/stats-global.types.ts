export type StatsGlobalRow = {
  idPatient: number;
  patientName?: string | null;
  idEvaluation: number;
  date: string;

  indexId: number;
  indexName: string;
  value: number;

  groupId?: number | null;
  groupName?: string | null;

  revisorId?: number | null;
  revisorName?: string | null;

  surveyId?: number | null;
  surveyName?: string | null;
};

export type StatsParametros = {
  seriesGroups: { groupId: number; groupName: string }[];
  availableIndices: { indexId: number; indexName: string }[];
  range: { from?: string; to?: string };
};

export type StatsGlobalResponse = {
  data: StatsGlobalRow[];
  parametros: StatsParametros;
  paging: { page: number; limit: number; totalRows: number; hasMore: boolean };
};
