import { useQuery } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { Check, Trophy } from "lucide-react";
import { XP_TIERS } from "@shared/xpTiers";

// XP skill tiers on the profile (Fuller Feuds Dev, Nov 20 2026). Editorial look: paper, red, gold.
type TierInfo = { id: string; name: string; minXp: number; color: string } | null;
export interface SkillRow {
  id: string;
  name: string;
  icon: string;
  rules: string[];
  xp: number;
  tier: TierInfo;
  tierBadgeId: string | null;
  nextTier: TierInfo;
}

const PAPER = "#f7f2e9";
const RED = "#8c2121";
const GOLD = "#b38a2e";
const fmt = (n: number) => n.toLocaleString("en-US");

export function useUserSkills(userId?: string) {
  return useQuery<SkillRow[]>({
    queryKey: ["/api/users", userId, "skills"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/skills`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!userId,
  });
}

export function SkillTiers({
  userId,
  isOwnProfile,
  selectedBadgeId,
  onSelect,
  selecting,
}: {
  userId: string;
  isOwnProfile: boolean;
  selectedBadgeId: string | null;
  onSelect: (badgeId: string | null) => void;
  selecting: boolean;
}) {
  const { data: skills = [], isLoading } = useUserSkills(userId);
  if (isLoading || skills.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-skill-tiers">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h3 className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Skill tiers
        </h3>
        <p className="font-ui text-[0.65rem] text-muted-foreground" data-testid="text-tier-ladder">
          {XP_TIERS.map((t) => `${t.name} ${t.minXp >= 1000 ? `${t.minXp / 1000}k` : t.minXp}`).join(" · ")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map((s) => {
          const Icon = (LucideIcons as any)[s.icon] || Trophy;
          const floor = s.tier?.minXp ?? 0;
          const ceil = s.nextTier?.minXp ?? floor;
          const pct = s.nextTier ? Math.max(0, Math.min(100, ((s.xp - floor) / (ceil - floor)) * 100)) : 100;
          const tierIdx = s.tier ? XP_TIERS.findIndex((t) => t.id === s.tier!.id) : -1;
          const isShown = !!s.tierBadgeId && s.tierBadgeId === selectedBadgeId;
          const accent = s.tier?.color ?? "#a39a8a";
          return (
            <div
              key={s.id}
              className="relative rounded-lg border p-3"
              style={{ background: PAPER, borderColor: isShown ? RED : "rgba(140,33,33,0.18)", boxShadow: isShown ? `0 0 0 1px ${RED}` : undefined }}
              data-testid={`skill-${s.id}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: s.tier ? `${accent}1f` : "rgba(0,0,0,0.04)",
                    border: `2px solid ${s.tier ? accent : "rgba(0,0,0,0.12)"}`,
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: s.tier ? accent : "#9a9184" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-serif text-[0.95rem] font-semibold leading-tight" style={{ color: "#2a2420" }}>
                      {s.name}
                    </h4>
                    <span
                      className="font-ui rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em]"
                      style={
                        s.tier
                          ? { color: "#fff", background: accent }
                          : { color: "#8a8174", background: "rgba(0,0,0,0.05)" }
                      }
                      data-testid={`skill-tier-${s.id}`}
                    >
                      {s.tier ? s.tier.name : "Unranked"}
                    </span>
                  </div>
                  <p className="font-ui mt-0.5 text-xs tabular-nums" style={{ color: RED }} data-testid={`skill-xp-${s.id}`}>
                    {fmt(s.xp)} XP
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(140,33,33,0.1)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.nextTier ? GOLD : accent }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="font-ui text-[0.68rem] text-muted-foreground">
                      {s.nextTier ? `${fmt(s.nextTier.minXp - s.xp)} XP to ${s.nextTier.name}` : "Top tier reached"}
                    </p>
                    <div className="flex gap-1" aria-label="Tier ladder">
                      {XP_TIERS.map((t, i) => (
                        <span
                          key={t.id}
                          title={`${t.name}: ${fmt(t.minXp)} XP`}
                          className="h-2 w-2 rounded-full"
                          style={{ background: i <= tierIdx ? t.color : "rgba(0,0,0,0.12)" }}
                        />
                      ))}
                    </div>
                  </div>
                  <details className="mt-1.5">
                    <summary className="font-ui cursor-pointer select-none text-[0.68rem]" style={{ color: RED }}>
                      How to earn
                    </summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[0.68rem] text-muted-foreground">
                      {s.rules.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </details>
                  {isOwnProfile && s.tierBadgeId && (
                    <button
                      type="button"
                      className="font-ui mt-2 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs"
                      style={{ borderColor: isShown ? RED : "rgba(140,33,33,0.3)", color: RED, background: isShown ? "transparent" : "#fffaf1" }}
                      onClick={() => onSelect(isShown ? null : s.tierBadgeId)}
                      disabled={selecting}
                      data-testid={`button-select-skill-${s.id}`}
                    >
                      {isShown && <Check className="h-3 w-3" />}
                      {isShown ? "Shown · Hide" : "Show on avatar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
