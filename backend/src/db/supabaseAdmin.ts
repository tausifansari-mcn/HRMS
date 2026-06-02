// @ts-expect-error no bundled types for ws; polyfilling globalThis for Supabase realtime
import WS from "ws";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebSocket = WS as any;
(globalThis as any).WebSocket = WebSocket;

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

// Supabase is no longer used for auth — MySQL JWT is the authority.
// These clients are retained only for non-auth usage (storage, native-table pages).
// When SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are not set, return a no-op stub
// so the backend starts without Supabase credentials.

function makeStubClient(): SupabaseClient {
  const stub = { auth: { getUser: async () => ({ data: { user: null }, error: { message: "Supabase not configured" } }) } };
  return stub as unknown as SupabaseClient;
}

const hasCredentials = !!(env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_ANON_KEY);

export const supabaseAdmin: SupabaseClient = hasCredentials
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : makeStubClient();

export const supabaseAuthClient: SupabaseClient = hasCredentials
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : makeStubClient();
