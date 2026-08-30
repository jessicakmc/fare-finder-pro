// Supabase connection details for this app.
//
// Both values are public by design: the project URL and the *publishable*
// (anon) key are compiled into the client bundle and are visible to anyone who
// loads the site. Access is enforced by Row Level Security on the database, not
// by keeping this key secret. Never put a service-role / secret key here.
//
// Vercel ignores a committed .env file during builds, so these literals are
// what a deployed build actually uses. To point a build at a different Supabase
// project, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY — in a local
// .env (see .env.example) or in Vercel's Project Settings → Environment
// Variables — and they take precedence over the defaults below.

const DEFAULT_SUPABASE_URL = "https://czaihdfdkpszbkcthybr.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3Y8lEdpntGiKVlonjHAA_w_R5V8m-Y-";

export const SUPABASE_URL: string = import.meta.env["VITE_SUPABASE_URL"] || DEFAULT_SUPABASE_URL;

export const SUPABASE_PUBLISHABLE_KEY: string =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
