import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con Service Role
 * - Bypasea RLS (Row Level Security)
 * - Solo usar en Server Actions y API Routes
 * - NUNCA exponer al cliente
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)