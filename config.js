// ═══════════════════════════════════════════════════════
// RIDER MOTORPARTS — Supabase Configuration
// ═══════════════════════════════════════════════════════
// 
// SETUP INSTRUCTIONS:
// 1. Go to https://supabase.com and create a new project
// 2. Run the SQL in /supabase/schema.sql in the SQL Editor
// 3. Go to Project Settings → API
// 4. Copy your Project URL and anon/public key below
// 5. Also copy these values into your .env file for Netlify/Vercel
//
// ════════════════════════════════════════════════════════

const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://xfygrjbxytamyrzwfkwt.supabase.co';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'sb_publishable_FFp7MGSwvEGSGeCFmIv7-w_nKd4sLX4';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in app.js
window.db = supabaseClient;
