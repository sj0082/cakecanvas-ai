
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

        // Check for duplicates in stylepacks where parent_id is null
        const res = await client.query(`
      SELECT name, count(*) 
      FROM stylepacks 
      WHERE parent_id IS NULL
      GROUP BY name
      HAVING count(*) > 1;
    `);

        if (res.rows.length === 0) {
            console.log('✅ No duplicates found for root stylepacks.');
        } else {
            console.log('⚠️ Duplicates still exist:');
            res.rows.forEach(row => {
                console.log(`${row.name}: ${row.count}`);
            });
        }

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await client.end();
    }
}

run();
