export function normOrderDir(dir?: string, def: 'ASC'|'DESC' = 'ASC'): 'ASC'|'DESC' {
  const d = (dir || def).toUpperCase();
  return d === 'DESC' ? 'DESC' : 'ASC';
}

export function buildMeta(params: {
  page: number;
  limit: number;
  totalItems: number;
  orderBy: string;
  orderDir: 'ASC'|'DESC';
  q?: string;
  filters?: Record<string, any>;
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
