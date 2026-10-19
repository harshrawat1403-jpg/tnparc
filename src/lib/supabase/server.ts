import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route Handlers.
 * Enforces RLS using caller's authenticated session cookies.
 */
export async function createClient() {
  type CookieStore = Awaited<ReturnType<typeof cookies>>;
  let cookieStore: CookieStore;

  try {
    cookieStore = await cookies();
  } catch {
    const memoryCookies = new Map<string, string>();
    cookieStore = {
      getAll() {
        return Array.from(memoryCookies.entries()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      set(name: string, value: string) {
        memoryCookies.set(name, value);
      },
    } as unknown as CookieStore;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
    );
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (typeof cookieStore.set === "function") {
              cookieStore.set(name, value, options);
            }
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware/proxy refreshing
          // user sessions.
        }
      },
    },
  });
}
