import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to verify connectivity
export async function checkSupabaseConnection(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from('subjects').select('id').limit(1);
    if (error) {
      console.warn('Supabase configuration exists but failed to connect/query:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase connection error:', err);
    return false;
  }
}
