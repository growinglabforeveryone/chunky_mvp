import { create } from "zustand";
import { supabase } from "@/lib/supabaseClient";

export const FREE_AI_LIMIT = 20;
export const FREE_VOCAB_LIMIT = 200;

interface UsageStore {
  tier: "free" | "premium";
  usedThisMonth: number;
  tipSeen: boolean;
  isLoaded: boolean;
  loadUsage: () => Promise<void>;
  incrementUsage: () => void;
  canUseAI: () => boolean;
  markTipSeen: () => Promise<void>;
}

export const useUsageStore = create<UsageStore>((set, get) => ({
  tier: "free",
  usedThisMonth: 0,
  tipSeen: false,
  isLoaded: false,

  loadUsage: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get tier + tip_seen
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, tip_seen")
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
      tipSeen: profile?.tip_seen ?? false,
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

  markTipSeen: async () => {
    set({ tipSeen: true });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ tip_seen: true })
      .eq("id", user.id);
  },
}));
