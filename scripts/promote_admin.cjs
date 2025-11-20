
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

        // Check if user_roles table/view exists
        const res = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'user_roles';
    `);

        let userRolesExists = false;
        if (res.rows.length > 0) {
            console.log('Found user_roles:', res.rows[0]);
            userRolesExists = true;
        } else {
            console.log('user_roles table/view NOT found in public schema');
        }

        // Emails to promote
        const emails = ['sj0082@gmail.com', 'vision@bakesbymarie.com'];

        for (const email of emails) {
            console.log(`Processing ${email}...`);

            // Try to find in auth.users
            try {
                const authRes = await client.query(`
              SELECT id, email FROM auth.users WHERE email = $1;
          `, [email]);

                if (authRes.rows.length > 0) {
                    const userId = authRes.rows[0].id;
                    console.log(`Found user in auth.users: ${userId}`);

                    // 0. Confirm Email
                    try {
                        await client.query(`
                    UPDATE auth.users
                    SET email_confirmed_at = NOW()
                    WHERE id = $1
                `, [userId]);
                        console.log(`✅ Confirmed email for ${email}`);
                    } catch (e) {
                        console.log(`⚠️ Failed to confirm email for ${email}: ${e.message}`);
                    }

                    // 1. Insert/Update profiles
                    try {
                        await client.query(`
                    INSERT INTO public.profiles (id, email, role)
                    VALUES ($1, $2, 'admin')
                    ON CONFLICT (id) DO UPDATE SET role = 'admin'
                `, [userId, email]);
                        console.log(`✅ Inserted/Updated profile for ${email}`);
                    } catch (e) {
                        console.log(`⚠️ Failed to update profiles for ${email}: ${e.message}`);
                    }

                    // 2. Insert/Update user_roles if table exists
                    if (userRolesExists) {
                        try {
                            // Check if user_role exists
                            const urCheck = await client.query(`SELECT * FROM user_roles WHERE user_id = $1`, [userId]);
                            if (urCheck.rows.length === 0) {
                                await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')`, [userId]);
                                console.log(`✅ Inserted into user_roles for ${email}`);
                            } else {
                                await client.query(`UPDATE user_roles SET role = 'admin' WHERE user_id = $1`, [userId]);
                                console.log(`✅ Updated user_roles for ${email}`);
                            }
                        } catch (e) {
                            console.log(`⚠️ Failed to update user_roles for ${email}: ${e.message}`);
                        }
                    }
                } else {
                    console.log(`❌ User ${email} not found in auth.users`);
                }
            } catch (err) {
                console.error('Error querying auth.users:', err.message);
            }
        }

    } catch (err) {
        console.error('Database error:', err);
    } finally {
        await client.end();
    }
}

run();
