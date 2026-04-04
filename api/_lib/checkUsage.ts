import { createClient } from "@supabase/supabase-js";

const FREE_MONTHLY_LIMIT = 20;

interface UsageCheckResult {
  allowed: boolean;
  userId: string;
  tier: string;
  used: number;
  limit: number;
}

/**
 * Verify user auth + check AI usage limits.
 * Call this from extract/correct endpoints (NOT meaning).
 * Returns userId if allowed, or a Response to send back if blocked.
 */
export async function checkUsage(
  req: Request,
  endpoint: string,
): Promise<{ result: UsageCheckResult } | { response: Response }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      response: new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      response: new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  // Get tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const tier = profile?.tier ?? "free";

  // Premium users: no limit
  if (tier === "premium") {
    return { result: { allowed: true, userId: user.id, tier, used: 0, limit: Infinity } };
  }

  // Count this month's usage
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart);

  const used = count ?? 0;

  if (used >= FREE_MONTHLY_LIMIT) {
    return {
      response: new Response(
        JSON.stringify({
          error: "monthly_limit",
          used,
          limit: FREE_MONTHLY_LIMIT,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  return {
    result: { allowed: true, userId: user.id, tier, used, limit: FREE_MONTHLY_LIMIT },
  };
}

/**
 * Record an AI usage event. Call AFTER successful API response.
 */
export async function recordUsage(userId: string, endpoint: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  );

  await supabase.from("ai_usage").insert({
    user_id: userId,
    endpoint,
  });
}
