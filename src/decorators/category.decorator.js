export const categoryDecorator = (category) => {
  if (!category) return null;

  return {
    id: category.id,
    name: category.name,
    user_id: category.user_id,
    created_at: category.created_at,
    updated_at: category.updated_at
  };
};