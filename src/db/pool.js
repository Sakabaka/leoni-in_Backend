import mysql from 'mysql2/promise';
import { dbConfig } from '../config/db.js';

export const pool = mysql.createPool(dbConfig);

export async function testDbConnection() {
  const [rows] = await pool.query('SELECT 1 + 1 AS ok');
  return rows[0]?.ok === 2;
}
