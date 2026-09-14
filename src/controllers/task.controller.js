import { randomUUID } from 'crypto';
import { pool } from '../db/connection.js';
import { taskDecorator } from '../decorators/task.decorator.js';
import { getPaginationParams, buildPagination } from '../utils/pagination.js';
import { isValidUUID, isValidName } from '../utils/validation.js';
import { resolveTaskStatus } from '../utils/task.js';

const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1000;

async function fetchTask(taskId) {
  const [rows] = await pool.query(
    'SELECT id, title, description, status, category_id, user_id, created_at, updated_at FROM tasks WHERE id = ? AND deleted_at IS NULL',
    [taskId]
  );

  if (rows.length === 0) return null;

  const task = rows[0];

  const [categoryRows] = await pool.query(
    'SELECT id, name FROM categories WHERE id = ? AND deleted_at IS NULL',
    [task.category_id]
  );

  const [tagRows] = await pool.query(
    `SELECT t.id, t.name
     FROM tags t
     JOIN tags_task tt ON tt.tag_id = t.id
     WHERE tt.task_id = ? AND t.deleted_at IS NULL`,
    [taskId]
  );

  return taskDecorator({
    ...task,
    category: categoryRows[0] || null,
    tags: tagRows
  });
}

async function index(req, res, next) {
  try {
    const { page, perPage, offset } = getPaginationParams(req.query);

    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM tasks WHERE deleted_at IS NULL'
    );

    const [tasks] = await pool.query(
      `SELECT id, title, description, status, category_id, user_id, created_at, updated_at
       FROM tasks
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [perPage, offset]
    );

    const categoryIds = [...new Set(tasks.map((task) => task.category_id))];
    const categoriesById = new Map();

    if (categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(', ');

      const [categoryRows] = await pool.query(
        `SELECT id, name FROM categories WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        categoryIds
      );

      for (const category of categoryRows) {
        categoriesById.set(category.id, category);
      }
    }

    const tagsByTask = new Map();

    if (tasks.length > 0) {
      const taskIds = tasks.map((task) => task.id);
      const placeholders = taskIds.map(() => '?').join(', ');

      const [tagRows] = await pool.query(
        `SELECT tt.task_id, t.id, t.name
         FROM tags t
         JOIN tags_task tt ON tt.tag_id = t.id
         WHERE tt.task_id IN (${placeholders}) AND t.deleted_at IS NULL`,
        taskIds
      );

      for (const task of tasks) {
        tagsByTask.set(task.id, []);
      }

      for (const tagRow of tagRows) {
        tagsByTask.get(tagRow.task_id).push({ id: tagRow.id, name: tagRow.name });
      }
    }

    const data = tasks.map((task) =>
      taskDecorator({
        ...task,
        category: categoriesById.get(task.category_id) || null,
        tags: tagsByTask.get(task.id) || []
      })
    );

    res.status(200).json({
      data,
      pagination: buildPagination({ page, perPage, total: countRows[0].total })
    });
  } catch (error) {
    next(error);
  }
}

async function show(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: 'El id de la tarea no es un UUID válido'
      });
    }

    const task = await fetchTask(id);

    if (!task) {
      return res.status(404).json({
        message: 'La tarea no existe'
      });
    }

    res.status(200).json({
      task
    });
  } catch (error) {
    next(error);
  }
}

async function store(req, res, next) {
  try {
    const { title, description, category_id, user_id, status, completed, tags } = req.body || {};

    if (!isValidName(title, { min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH })) {
      return res.status(400).json({
        message: 'El título debe tener entre 1 y 255 caracteres'
      });
    }

    const normalizedDescription =
      description !== undefined && description !== null ? String(description).trim() : '';

    if (normalizedDescription.length > DESCRIPTION_MAX_LENGTH) {
      return res.status(400).json({
        message: 'La descripción no puede superar los 1000 caracteres'
      });
    }

    if (!isValidUUID(user_id)) {
      return res.status(400).json({
        message: 'El user_id debe ser un UUID válido'
      });
    }

    if (!isValidUUID(category_id)) {
      return res.status(400).json({
        message: 'El category_id debe ser un UUID válido'
      });
    }

    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (userRows.length === 0) {
      return res.status(400).json({
        message: 'El usuario indicado no existe'
      });
    }

    const [categoryRows] = await pool.query(
      'SELECT id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [category_id, user_id]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({
        message: 'La categoría indicada no existe o no pertenece al usuario'
      });
    }

    const statusValue = resolveTaskStatus({ status, completed });
    if (!statusValue) {
      return res.status(400).json({
        message: 'El estado debe ser pending, in_progress o completed'
      });
    }

    const tagIds = Array.isArray(tags) ? tags : [];

    if (tagIds.some((tagId) => !isValidUUID(tagId))) {
      return res.status(400).json({
        message: 'Cada etiqueta debe ser un UUID válido'
      });
    }

    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(', ');

      const [existingTags] = await pool.query(
        `SELECT id FROM tags WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`,
        [...tagIds, user_id]
      );

      if (existingTags.length !== tagIds.length) {
        return res.status(400).json({
          message: 'Una o más etiquetas no existen o no pertenecen al usuario'
        });
      }
    }

    const id = randomUUID();

    await pool.query(
      'INSERT INTO tasks (id, title, description, status, category_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, String(title).trim(), normalizedDescription || null, statusValue, category_id, user_id]
    );

    if (tagIds.length > 0) {
      const values = tagIds.map((tagId) => [tagId, id]);
      await pool.query('INSERT INTO tags_task (tag_id, task_id) VALUES ?', [values]);
    }

    const task = await fetchTask(id);

    res.status(201).json({
      task
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, category_id, user_id, status, completed, tags } = req.body || {};

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: 'El id de la tarea no es un UUID válido'
      });
    }

    const [existingRows] = await pool.query(
      'SELECT id, user_id FROM tasks WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        message: 'La tarea no existe'
      });
    }

    const currentUser = user_id !== undefined && user_id !== null && user_id !== ''
      ? user_id
      : existingRows[0].user_id;

    if (!isValidUUID(currentUser)) {
      return res.status(400).json({
        message: 'El user_id debe ser un UUID válido'
      });
    }

    if (!isValidName(title, { min: TITLE_MIN_LENGTH, max: TITLE_MAX_LENGTH })) {
      return res.status(400).json({
        message: 'El título debe tener entre 1 y 255 caracteres'
      });
    }

    const normalizedDescription =
      description !== undefined && description !== null ? String(description).trim() : '';

    if (normalizedDescription.length > DESCRIPTION_MAX_LENGTH) {
      return res.status(400).json({
        message: 'La descripción no puede superar los 1000 caracteres'
      });
    }

    if (!isValidUUID(category_id)) {
      return res.status(400).json({
        message: 'El category_id debe ser un UUID válido'
      });
    }

    const [categoryRows] = await pool.query(
      'SELECT id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [category_id, currentUser]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({
        message: 'La categoría indicada no existe o no pertenece al usuario'
      });
    }

    const statusValue = resolveTaskStatus({ status, completed });
    if (!statusValue) {
      return res.status(400).json({
        message: 'El estado debe ser pending, in_progress o completed'
      });
    }

    const tagIds = Array.isArray(tags) ? tags : [];

    if (tagIds.some((tagId) => !isValidUUID(tagId))) {
      return res.status(400).json({
        message: 'Cada etiqueta debe ser un UUID válido'
      });
    }

    if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => '?').join(', ');

      const [existingTags] = await pool.query(
        `SELECT id FROM tags WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`,
        [...tagIds, currentUser]
      );

      if (existingTags.length !== tagIds.length) {
        return res.status(400).json({
          message: 'Una o más etiquetas no existen o no pertenecen al usuario'
        });
      }
    }

    await pool.query(
      'UPDATE tasks SET title = ?, description = ?, status = ?, category_id = ?, user_id = ? WHERE id = ? AND deleted_at IS NULL',
      [String(title).trim(), normalizedDescription || null, statusValue, category_id, currentUser, id]
    );

    await pool.query('DELETE FROM tags_task WHERE task_id = ?', [id]);

    if (tagIds.length > 0) {
      const values = tagIds.map((tagId) => [tagId, id]);
      await pool.query('INSERT INTO tags_task (tag_id, task_id) VALUES ?', [values]);
    }

    const task = await fetchTask(id);

    res.status(200).json({
      task
    });
  } catch (error) {
    next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: 'El id de la tarea no es un UUID válido'
      });
    }

    const [result] = await pool.query(
      'UPDATE tasks SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'La tarea no existe'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, title, description, status, category_id, user_id, created_at, updated_at FROM tasks WHERE id = ?',
      [id]
    );

    res.status(200).json({
      message: 'Tarea eliminada',
      task: taskDecorator({
        ...rows[0],
        category: null,
        tags: []
      })
    });
  } catch (error) {
    next(error);
  }
}

export { index, show, store, update, destroy };