/**
 * Online matchmaking config.
 *
 * The Supabase "anon"/publishable key is designed to be public: it ships in the
 * browser and can only do what the database's row-level security allows
 * (insert armies, call find_opponent). Never put the service_role key here.
 *
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars override these at build time.
 * Leave both empty to play fully offline against AI armies.
 */
const DEFAULT_URL = '';
const DEFAULT_ANON_KEY = '';

export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, '');
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

/**
 * Bump whenever creatures, stats or rules change in a way that makes old saved
 * armies unfair or invalid. Players only match armies saved on the same version.
 */
export const GAME_VERSION = 3;

export const onlineEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
