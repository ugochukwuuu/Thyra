// The Thyra API, served by Supabase Edge Functions at /functions/v1/api.
// Locally: `npm run api` from the project root (see README).
import { createApp } from './app.js';

Deno.serve(createApp().fetch);
