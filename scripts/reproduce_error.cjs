
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fqqbohnpgpavkbijtqgq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxcWJvaG5wZ3BhdmtiaWp0cWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MDA0MjAsImV4cCI6MjA3OTE3NjQyMH0.9rbKRyq76kGsRZCRSJXvCTsxax2OzTtJe-hde1BZGMU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function reproduce() {
    try {
        console.log('Fetching size category...');
        const { data: sizes, error: sizeError } = await supabase
            .from('size_categories')
            .select('id')
            .limit(1);

        if (sizeError) throw sizeError;
        if (!sizes || sizes.length === 0) throw new Error('No size categories found');
        const sizeId = sizes[0].id;
        console.log('Size ID:', sizeId);

        console.log('Fetching style pack...');
        const { data: styles, error: styleError } = await supabase
            .from('stylepacks')
            .select('id')
            .limit(1);

        if (styleError) throw styleError;
        if (!styles || styles.length === 0) throw new Error('No style packs found');
        const styleId = styles[0].id;
        console.log('Style ID:', styleId);

        const payload = {
            size_category_id: sizeId,
            stylepack_id: styleId,
            user_text: "Test request",
            parsed_slots: {
                colorPalette: "ivory-cream",
                decorationStyle: "minimalist",
                themeMood: "elegant-sophisticated",
                textureFinish: "smooth-fondant",
                occasion: "wedding"
            },
            user_images: null,
            contact_name: "Test User",
            contact_email: "test@example.com",
            contact_phone: "1234567890",
            customer_notes: "Test notes",
            status: "GENERATING"
        };

        console.log('Invoking create-request...');
        const { data, error } = await supabase.functions.invoke('create-request', {
            body: payload
        });

        if (error) {
            console.error('Function Invocation Error:', error);
            if (error.context) {
                console.error('Error Context:', await error.context.json());
            }
        } else {
            console.log('Success:', data);
        }

    } catch (err) {
        console.error('Script Error:', err);
    }
}

reproduce();
