require('dotenv').config({ path: './frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addIsActiveColumn() {
    // Since we are using anon key, we might not have permissions to run ALTER TABLE.
    // Generally, schema changes must be done via Supabase Dashboard SQL editor.
    // We will try using supabase.rpc or a direct query if possible, but standard REST 
    // API doesn't allow DDL. Thus, this script will likely fail with anon key.
    console.log("Schema changes like ALTER TABLE should be run from the Supabase Dashboard SQL Editor.");
    console.log("Please run:");
    console.log("ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;");
    console.log("We will proceed by updating the service to use is_active if it exists, or provide the SQL for the user.");
}

addIsActiveColumn();
