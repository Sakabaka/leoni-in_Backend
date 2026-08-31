import { pool } from '../db/pool.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotification(employeeIds, title, body, data = {}) {
  try {
    const ids = [...new Set(employeeIds.filter(Boolean))];
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT token FROM push_tokens WHERE employee_id IN (${placeholders})`,
      ids,
    );
    if (!rows.length) return;

    const messages = rows.map((row) => ({
      to: row.token,
      sound: 'default',
      title,
      body,
      data,
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!response.ok) console.warn('Expo push notification failed:', response.status);
  } catch (error) {
    console.warn('Expo push notification error:', error.message);
  }
}
