// The one module that talks to the Supabase database (ADR 011: one data module per store), so the
// query layer can change without a sweep through the screens.
//
// Medical flags are NOT read here. The medical_flags table is closed to every client role; the
// only path to it is the medical Edge Function, called from src/medical/ once that story lands
// (ADR 002).
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.ts'

export const db = createClient(config.supabaseUrl, config.supabaseAnonKey)
