
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:mhTg25Ur7-B2aX+@db.fqqbohnpgpavkbijtqgq.supabase.co:5432/postgres';
const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
      SELECT id, name, is_category, parent_id, created_at 
      FROM stylepacks 
      WHERE name IN ('Romantic Floral', 'Vintage Elegance', 'Modern Minimalist', 'Event')
      ORDER BY name, created_at;
    `);

        console.log('Stylepacks Dump:');
        res.rows.forEach(row => {
            console.log(`${row.name} (Category: ${row.is_category}, Parent: ${row.parent_id}, ID: ${row.id}, Created: ${row.created_at})`);
        });

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await client.end();
    }
}

run();
