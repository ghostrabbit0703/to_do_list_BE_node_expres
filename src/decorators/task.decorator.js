export const taskDecorator = (task) => {
  if (!task) return null;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    completed: task.status === 'completed',
    category_id: task.category_id,
    user_id: task.user_id,
    category: task.category
      ? { id: task.category.id, name: task.category.name }
      : null,
    tags: Array.isArray(task.tags) ? task.tags : [],
    created_at: task.created_at,
    updated_at: task.updated_at
  };
};