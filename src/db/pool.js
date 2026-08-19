import mysql from 'mysql2/promise';
import { dbConfig } from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = mysql.createPool(dbConfig);

export async function testDbConnection() {
  const [rows] = await pool.query('SELECT 1 + 1 AS ok');
  return rows[0]?.ok === 2;
}

export async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl,
  });

  try {
    const dbName = dbConfig.database;
    
    // Managed providers usually provision the database and may deny CREATE DATABASE.
    if (process.env.DB_CREATE_DATABASE !== 'false') {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    }
    await connection.query(`USE \`${dbName}\`;`);

    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, '../..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Remove SQL comments before splitting so statements preceded by comments run.
    const statements = schema
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        // Ignore errors like "Table already exists" - that's fine
        if (!error.message.includes('already exists')) {
          console.warn('Error executing statement:', error.message);
        }
      }
    }

    console.log(`Database ${dbName} initialized with schema.`);
  } catch (error) {
    console.error('Database initialization error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}
