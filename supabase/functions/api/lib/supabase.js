import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let adminClient;
const admin = () => (adminClient ??= createClient(config.supabaseUrl, config.serviceRoleKey, options));

const emailExists = (error) => error?.code === 'email_exists' || error?.status === 422;

/**
 * Every call the API makes to Supabase Auth. Accounts are created and changed here with the
 * service role key; people sign in from the browser. Tests replace these methods with fakes.
 */
export const auth = {
  /** The user id behind an access token from the browser, or null when it is missing, expired or forged. */
  async userIdFromToken(token) {
    const { data, error } = await admin().auth.getClaims(token);
    return error ? null : (data?.claims?.sub ?? null);
  },

  /** Creates a confirmed sign-in account. Returns its id, or null when the email is already registered. */
  async createUser(email, password) {
    const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    if (emailExists(error)) return null;
    if (error) throw error;
    return data.user.id;
  },

  /** Changes the email and/or password. Returns false when another account already has the email. */
  async updateUser(id, { email, password }) {
    const { error } = await admin().auth.admin.updateUserById(id, {
      ...(email && { email, email_confirm: true }),
      ...(password && { password }),
    });
    if (emailExists(error)) return false;
    if (error) throw error;
    return true;
  },

  /** Removes a sign-in account. The matching public.users row and everything under it cascade. */
  async deleteUser(id) {
    const { error } = await admin().auth.admin.deleteUser(id);
    if (error && error.status !== 404) throw error;
  },

  /** Checks an email and password without keeping the session, e.g. before changing a password. */
  async passwordMatches(email, password) {
    const client = createClient(config.supabaseUrl, config.anonKey, options);
    const { error } = await client.auth.signInWithPassword({ email, password });
    return !error;
  },
};
