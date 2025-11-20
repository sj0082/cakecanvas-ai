
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

        const names = ['Romantic Floral', 'Vintage Elegance', 'Modern Minimalist', 'Event'];

        for (const name of names) {
            const res = await client.query(`
            SELECT id, name, is_category, parent_id, created_at 
            FROM stylepacks 
            WHERE name = $1 AND parent_id IS NULL
            ORDER BY created_at;
        `, [name]);

            console.log(`\nChecking '${name}': Found ${res.rows.length} entries`);

            for (const row of res.rows) {
                // Count children
                const childRes = await client.query(`SELECT count(*) FROM stylepacks WHERE parent_id = $1`, [row.id]);
                const childCount = childRes.rows[0].count;
                console.log(` - ID: ${row.id}`);
                console.log(`   Created: ${row.created_at}`);
                console.log(`   Is Category: ${row.is_category}`);
                console.log(`   Child Count: ${childCount}`);
                console.log('   ---');
            }
        }

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await client.end();
    }
}

run();
