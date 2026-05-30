// @ts-expect-error no bundled types for ws; polyfilling globalThis for Supabase realtime
import WS from "ws";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WebSocket = WS as any;
(globalThis as any).WebSocket = WebSocket;

import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const supabaseAuthClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
