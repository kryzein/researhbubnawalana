import { supabase } from "@/integrations/supabase/client";

export async function liveblocksAuthEndpoint(room?: string): Promise<{token: string}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/liveblocks-auth`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ room }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to authorize with Liveblocks");
  }

  return await response.json();
}
