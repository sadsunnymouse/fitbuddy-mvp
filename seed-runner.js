const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: 'postgresql://fitbuddy_db_leh3_user:3nJquRTmrSVBEkIfmAHKs6kmb2CVC8kz@dpg-d7hta19o3t8c73fufn20-a.virginia-postgres.render.com/fitbuddy_db_leh3',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database');
    const sql = fs.readFileSync(path.join(__dirname, 'database', 'seed.sql'), 'utf8');
    await client.query(sql);
    console.log('Seed executed successfully');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();