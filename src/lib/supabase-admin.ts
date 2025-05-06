import { createClient } from '@supabase/supabase-js'

// Server-side only Supabase client - NEVER exposed to the browser
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)