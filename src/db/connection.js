import mysql from 'mysql2/promise';
import 'dotenv/config';

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

async function testConnection() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT 1');
        console.log('Conexión a la base de datos establecida');
        console.log('Resultado de la consulta de prueba:', rows);
        return true;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        return false;
    }finally {
        if(connection) connection.release();
    }
}

export { pool, testConnection };