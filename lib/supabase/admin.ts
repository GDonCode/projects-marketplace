import "server-only"; // the build fails if any browser-side file ever imports this module
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role key bypasses Row Level Security — this file must NEVER be
// imported into a Client Component or anything that ships to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}