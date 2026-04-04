import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

export const FREE_AI_LIMIT = 20;
export const FREE_VOCAB_LIMIT = 200;

interface UsageStore {
  tier: "free" | "premium";
  usedThisMonth: number;
  isLoaded: boolean;
  loadUsage: () => Promise<void>;
  incrementUsage: () => void;
  canUseAI: () => boolean;
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  tier: "free",
  usedThisMonth: 0,
  isLoaded: false,

  loadUsage: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    // Count this month's usage
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabase
      .from("ai_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart);

    set({
      tier: (profile?.tier ?? "free") as "free" | "premium",
      usedThisMonth: count ?? 0,
      isLoaded: true,
    });
  },

  incrementUsage: () => {
    set((s) => ({ usedThisMonth: s.usedThisMonth + 1 }));
  },

  canUseAI: () => {
    const { tier, usedThisMonth } = get();
    if (tier === "premium") return true;
    return usedThisMonth < FREE_AI_LIMIT;
  },
}));
