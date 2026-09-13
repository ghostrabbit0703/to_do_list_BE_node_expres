import { randomUUID } from 'crypto';
import { pool } from '../db/connection.js';
import { categoryDecorator } from '../decorators/category.decorator.js';
import { isValidUUID, isValidName } from '../utils/validation.js';
import { getPaginationParams, buildPagination } from '../utils/pagination.js';

async function index(req, res, next) {
  try {
    const { page, perPage, offset } = getPaginationParams(req.query);

    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM categories WHERE user_id = ? AND deleted_at IS NULL',
      [req.user.id]
    );

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, perPage, offset]
    );

    res.status(200).json({
      data: rows.map(categoryDecorator),
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
        message: 'El id de la categoría no es un UUID válido'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM categories WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'La categoría no existe'
      });
    }

    res.status(200).json({
      category: categoryDecorator(rows[0])
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
      'SELECT id FROM categories WHERE name = ? AND user_id = ? AND deleted_at IS NULL',
      [normalizedName, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Ya existe una categoría con ese nombre'
      });
    }

    const id = randomUUID();

    await pool.query(
      'INSERT INTO categories (id, name, user_id) VALUES (?, ?, ?)',
      [id, normalizedName, userId]
    );

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM categories WHERE id = ?',
      [id]
    );

    res.status(201).json({
      category: categoryDecorator(rows[0])
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
        message: 'El id de la categoría no es un UUID válido'
      });
    }

    if (!isValidName(name, { min: 1, max: 100 })) {
      return res.status(400).json({
        message: 'El nombre debe tener entre 1 y 100 caracteres'
      });
    }

    const [result] = await pool.query(
      'UPDATE categories SET name = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [String(name).trim(), id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'La categoría no existe'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM categories WHERE id = ?',
      [id]
    );

    res.status(200).json({
      category: categoryDecorator(rows[0])
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
        message: 'El id de la categoría no es un UUID válido'
      });
    }

    const [result] = await pool.query(
      'UPDATE categories SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'La categoría no existe'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, name, user_id, created_at, updated_at FROM categories WHERE id = ?',
      [id]
    );

    res.status(200).json({
      message: 'Categoría eliminada',
      category: categoryDecorator(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

export { index, show, store, update, destroy };