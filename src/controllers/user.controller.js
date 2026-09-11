import bcrypt from 'bcrypt';
import { pool } from '../db/connection.js';
import { userDecorator } from '../decorators/user.decorator.js';

const SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Los campos name, email y password son obligatorios'
      });
    }

    const normalizedName = String(name).trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El nombre debe tener entre 2 y 100 caracteres'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'El formato del email no es válido'
      });
    }

    const normalizedPassword = String(password);
    const hasUpperCase = /[A-Z]/.test(normalizedPassword);
    const hasLowerCase = /[a-z]/.test(normalizedPassword);
    const hasNumber = /\d/.test(normalizedPassword);
    const hasSymbol = /[^A-Za-z0-9]/.test(normalizedPassword);
    const passwordTooLong = Buffer.byteLength(normalizedPassword, 'utf8') > PASSWORD_MAX_BYTES;

    if (
      normalizedPassword.length < PASSWORD_MIN_LENGTH ||
      passwordTooLong ||
      !hasUpperCase ||
      !hasLowerCase ||
      !hasNumber ||
      !hasSymbol
    ) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message:
          'La contraseña debe tener entre 8 y 72 bytes e incluir al menos una mayúscula, una minúscula, un número y un símbolo'
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Ya existe un usuario con ese email'
      });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [normalizedName, normalizedEmail, hashedPassword]
    );

    const [rows] = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      data: userDecorator(rows[0])
    });
  } catch (error) {
    next(error);
  }
}

export { register };