
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

        const names = ['Romantic Floral', 'Vintage Elegance', 'Modern Minimalist'];

        for (const name of names) {
            console.log(`\nProcessing '${name}'...`);
            const res = await client.query(`
            SELECT id, name, created_at 
            FROM stylepacks 
            WHERE name = $1 AND parent_id IS NULL
            ORDER BY created_at;
        `, [name]);

            const candidates = [];
            for (const row of res.rows) {
                const childRes = await client.query(`SELECT count(*) FROM stylepacks WHERE parent_id = $1`, [row.id]);
                const childCount = parseInt(childRes.rows[0].count);
                candidates.push({ ...row, childCount });
            }

            // Sort: Max children first, then oldest
            candidates.sort((a, b) => {
                if (b.childCount !== a.childCount) return b.childCount - a.childCount;
                return new Date(a.created_at) - new Date(b.created_at);
            });

            if (candidates.length > 1) {
                const toKeep = candidates[0];
                console.log(`  KEEP: ID ${toKeep.id} (Children: ${toKeep.childCount})`);

                for (let i = 1; i < candidates.length; i++) {
                    const toDelete = candidates[i];
                    console.log(`  DELETE: ID ${toDelete.id} (Children: ${toDelete.childCount})`);

                    // Execute Delete
                    await client.query(`DELETE FROM stylepacks WHERE id = $1`, [toDelete.id]);
                    console.log(`  ✅ Deleted ${toDelete.id}`);
                }
            } else {
                console.log(`  No duplicates found (or only 1 entry).`);
            }
        }

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await client.end();
    }
}

run();
