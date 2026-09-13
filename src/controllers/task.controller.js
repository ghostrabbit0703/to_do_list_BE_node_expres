import { randomUUID } from 'crypto';
import { pool } from '../db/connection.js';
import { taskDecorator } from '../decorators/task.decorator.js';
import { getPaginationParams, buildPagination } from '../utils/pagination.js';
import { isValidUUID, isValidName, isValidStatus } from '../utils/validation.js';

const TITLE_MIN_LENGTH = 1;
const TITLE_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1000;

function resolveStatus({ status, completed }) {
  if (status !== undefined && status !== null && status !== '') {
    return isValidStatus(status) ? status : null;
  }

  if (typeof completed === 'boolean') {
    return completed ? 'completed' : 'pending';
  }

  return 'pending';
}

async function fetchTask(taskId, userId) {
  const [rows] = await pool.query(
    'SELECT id, title, description, status, category_id, user_id, created_at, updated_at FROM tasks WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [taskId, userId]
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
      'SELECT COUNT(*) AS total FROM tasks WHERE user_id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    const [rows] = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.category_id, t.user_id, t.created_at, t.updated_at,
              c.name AS category_name
       FROM tasks t
       JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
       WHERE t.user_id = ? AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, perPage, offset]
    );

    const tagsByTask = new Map();

    if (rows.length > 0) {
      const taskIds = rows.map((row) => row.id);
      const placeholders = taskIds.map(() => '?').join(', ');

      const [tagRows] = await pool.query(
        `SELECT t.id AS tag_id, t.name AS tag_name, tt.task_id
         FROM tags t
         JOIN tags_task tt ON tt.tag_id = t.id
         WHERE tt.task_id IN (${placeholders}) AND t.deleted_at IS NULL`,
        taskIds
      );

      for (const row of rows) {
        tagsByTask.set(row.id, []);
      }

      for (const tagRow of tagRows) {
        tagsByTask.get(tagRow.task_id).push({ id: tagRow.tag_id, name: tagRow.tag_name });
      }
    }

    const data = rows.map((row) =>
      taskDecorator({
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        category_id: row.category_id,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: row.category_name ? { id: row.category_id, name: row.category_name } : null,
        tags: tagsByTask.get(row.id) || []
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

    const task = await fetchTask(id, req.user.id);

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
    const { title, description, category_id, status, completed, tags } = req.body || {};

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

    const userId = req.user.id;

    if (!isValidUUID(category_id)) {
      return res.status(400).json({
        message: 'El category_id debe ser un UUID válido'
      });
    }

    const [categoryRows] = await pool.query(
      'SELECT id FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [category_id, userId]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({
        message: 'La categoría indicada no existe o no pertenece al usuario'
      });
    }

    const statusValue = resolveStatus({ status, completed });
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
        [...tagIds, userId]
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
      [id, String(title).trim(), normalizedDescription || null, statusValue, category_id, userId]
    );

    if (tagIds.length > 0) {
      const values = tagIds.map((tagId) => [tagId, id]);
      await pool.query('INSERT INTO tags_task (tag_id, task_id) VALUES ?', [values]);
    }

    const task = await fetchTask(id, userId);

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
    const { title, description, category_id, status, completed, tags } = req.body || {};

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: 'El id de la tarea no es un UUID válido'
      });
    }

    const userId = req.user.id;

    const [existingRows] = await pool.query(
      'SELECT id FROM tasks WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, userId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        message: 'La tarea no existe'
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
      [category_id, userId]
    );
    if (categoryRows.length === 0) {
      return res.status(400).json({
        message: 'La categoría indicada no existe o no pertenece al usuario'
      });
    }

    const statusValue = resolveStatus({ status, completed });
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
        [...tagIds, userId]
      );

      if (existingTags.length !== tagIds.length) {
        return res.status(400).json({
          message: 'Una o más etiquetas no existen o no pertenecen al usuario'
        });
      }
    }

    await pool.query(
      'UPDATE tasks SET title = ?, description = ?, status = ?, category_id = ?, user_id = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [String(title).trim(), normalizedDescription || null, statusValue, category_id, userId, id, userId]
    );

    await pool.query('DELETE FROM tags_task WHERE task_id = ?', [id]);

    if (tagIds.length > 0) {
      const values = tagIds.map((tagId) => [tagId, id]);
      await pool.query('INSERT INTO tags_task (tag_id, task_id) VALUES ?', [values]);
    }

    const task = await fetchTask(id, userId);

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
      'UPDATE tasks SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, req.user.id]
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