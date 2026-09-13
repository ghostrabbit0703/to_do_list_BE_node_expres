import { randomUUID } from 'crypto';
import { pool } from '../db/connection.js';
import { tagDecorator } from '../decorators/tag.decorator.js';
import { isValidUUID, isValidName } from '../utils/validation.js';
import { getPaginationParams, buildPagination } from '../utils/pagination.js';

async function index(req, res, next) {
  try {
    const { page, perPage, offset } = getPaginationParams(req.query);

    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM tags WHERE user_id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM tags WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, perPage, offset]
    );

    res.status(200).json({
      data: rows.map(tagDecorator),
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
        message: 'El id de la etiqueta no es un UUID válido'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM tags WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'La etiqueta no existe'
      });
    }

    res.status(200).json({
      tag: tagDecorator(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

async function store(req, res, next) {
  try {
    const { name } = req.body || {};

    if (!isValidName(name, { min: 1, max: 100 })) {
      return res.status(400).json({
        message: 'El nombre debe tener entre 1 y 100 caracteres'
      });
    }

    const userId = req.user.id;
    const normalizedName = String(name).trim();

    const [existing] = await pool.query(
      'SELECT id FROM tags WHERE name = ? AND user_id = ? AND deleted_at IS NULL',
      [normalizedName, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Ya existe una etiqueta con ese nombre'
      });
    }

    const id = randomUUID();

    await pool.query(
      'INSERT INTO tags (id, name, user_id) VALUES (?, ?, ?)',
      [id, normalizedName, userId]
    );

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM tags WHERE id = ?',
      [id]
    );

    res.status(201).json({
      tag: tagDecorator(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name } = req.body || {};

    if (!isValidUUID(id)) {
      return res.status(400).json({
        message: 'El id de la etiqueta no es un UUID válido'
      });
    }

    if (!isValidName(name, { min: 1, max: 100 })) {
      return res.status(400).json({
        message: 'El nombre debe tener entre 1 y 100 caracteres'
      });
    }

    const [result] = await pool.query(
      'UPDATE tags SET name = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [String(name).trim(), id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'La etiqueta no existe'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM tags WHERE id = ?',
      [id]
    );

    res.status(200).json({
      tag: tagDecorator(rows[0])
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
        message: 'El id de la etiqueta no es un UUID válido'
      });
    }

    const [result] = await pool.query(
      'UPDATE tags SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'La etiqueta no existe'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM tags WHERE id = ?',
      [id]
    );

    res.status(200).json({
      message: 'Etiqueta eliminada',
      tag: tagDecorator(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

export { index, show, store, update, destroy };