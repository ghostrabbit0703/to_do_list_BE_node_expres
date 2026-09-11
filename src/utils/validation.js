export const isValidUUID = (id) => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return typeof id === 'string' && uuidRegex.test(id);
};

export const isValidName = (value, { min = 2, max = 100 } = {}) => {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max;
};

export const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};