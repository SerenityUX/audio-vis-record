import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  let plantName;

  if (req.method === 'GET') {
    plantName = req.query.plantName;
    // Set content type to plain text for GET requests
    res.setHeader('Content-Type', 'text/plain');
  } else if (req.method === 'POST') {
    plantName = req.body.plantName;
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!plantName) {
    if (req.method === 'GET') {
      return res.status(400).send('Plant name is required');
    }
    return res.status(400).json({ error: 'Plant name is required' });
  }

  try {
    // Update the watered_at timestamp for the plant
    const result = await pool.query(
      `UPDATE WaterPlantLog 
       SET watered_at = CURRENT_TIMESTAMP 
       WHERE plant_name = $1 
       RETURNING *`,
      [plantName]
    );

    if (result.rows.length === 0) {
      if (req.method === 'GET') {
        return res.status(404).send('Plant not found');
      }
      return res.status(404).json({ error: 'Plant not found' });
    }

    if (req.method === 'GET') {
      return res.status(200).send('marked plant as watered');
    }
    return res.status(200).json({ success: true, plant: result.rows[0] });
  } catch (error) {
    console.error('Database error:', error);
    if (req.method === 'GET') {
      return res.status(500).send('Internal server error');
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

