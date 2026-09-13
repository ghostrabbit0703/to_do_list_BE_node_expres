export const getPaginationParams = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const perPage = Math.min(Math.max(1, Number.parseInt(query.per_page, 10) || 10), 100);
  const offset = (page - 1) * perPage;

  return { page, perPage, offset };
};

export const buildPagination = ({ page, perPage, total }) => ({
  current_page: page,
  last_page: Math.max(1, Math.ceil(total / perPage)),
  per_page: perPage,
  total
});