import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool } from '../db/connection.js';
import { userDecorator } from '../decorators/user.decorator.js';
import { signToken } from '../utils/jwt.js';

const SALT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Los campos name, email y password son obligatorios'
      });
    }

    const normalizedName = String(name).trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return res.status(400).json({
        message: 'El nombre debe tener entre 2 y 100 caracteres'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
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
        message: 'Ya existe un usuario con ese email'
      });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
    const id = randomUUID();

    await pool.query(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [id, normalizedName, normalizedEmail, hashedPassword]
    );

    const [rows] = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [id]
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

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: 'Los campos email y password son obligatorios'
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query(
      'SELECT id, name, email, password, created_at FROM users WHERE email = ?',
      [normalizedEmail]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    const isValidPassword = await bcrypt.compare(String(password), user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Credenciales inválidas'
      });
    }

    const token = signToken(user);

    res.status(200).json({
      message: 'Sesión iniciada correctamente',
      token,
      user: userDecorator(user)
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    res.status(200).json({
      message: 'Sesión cerrada correctamente'
    });
  } catch (error) {
    next(error);
  }
}

export { register, login, logout };