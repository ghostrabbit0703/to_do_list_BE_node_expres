import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  try {
    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No hay migraciones para ejecutar.');
      return;
    }

    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`Ejecutando migración: ${file}`);
      await pool.query(sql);
      console.log(`✔ Migración aplicada: ${file}`);
    }
  } catch (error) {
    console.error('Error al ejecutar migraciones:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigrations();