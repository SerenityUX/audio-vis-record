import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all plants with their current status
    // Using the view to get calculated days_until_next_watering
    const result = await pool.query(
      `SELECT 
        id, 
        plant_name, 
        watered_at, 
        watering_interval, 
        days_until_next_watering 
       FROM WaterPlantLogView 
       ORDER BY plant_name`
    );

    return res.status(200).json({ plants: result.rows });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

