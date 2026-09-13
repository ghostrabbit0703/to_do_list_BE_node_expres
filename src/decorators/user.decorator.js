export const userDecorator = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at
  };
};