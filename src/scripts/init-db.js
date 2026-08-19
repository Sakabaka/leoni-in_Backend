import { initializeDatabase } from '../db/pool.js';

async function main() {
  try {
    console.log('Starting database initialization...');
    await initializeDatabase();
    console.log('✓ Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

main();
