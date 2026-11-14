import { supabase as client } from '../supabaseClient';

if (!client) {
  throw new Error('Supabase environment variables are required for the AI management console.');
}

export const supabase = client;
