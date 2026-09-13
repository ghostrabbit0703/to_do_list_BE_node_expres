export const tagDecorator = (tag) => {
  if (!tag) return null;

  return {
    id: tag.id,
    name: tag.name,
    user_id: tag.user_id,
    created_at: tag.created_at,
    updated_at: tag.updated_at
  };
};