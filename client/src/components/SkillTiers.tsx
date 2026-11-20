import { useQuery } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { Check, Trophy, Lock } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { XP_TIERS } from "@shared/xpTiers";
import { BADGE_STACKS } from "@shared/badgeDefinitions";

// Level badges on the profile (Fuller Feuds Dev, Nov 20 2026): XP skill tiers and stacked milestone
// badges share one card. Colors come from theme variables (see .level-card in index.css), so they
// follow light, medium and dark themes.
type TierInfo = { id: string; name: string; minXp: number; color: string; darkColor?: string } | null;
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

const fmt = (n: number) => n.toLocaleString("en-US");
const GOLD_L = "hsl(40 62% 31%)";
const GOLD_D = "hsl(42 72% 62%)";

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

interface Dot {
  key: string;
  title: string;
  on: boolean;
  light: string;
  dark: string;
}

function LevelCard(props: {
  testId: string;
  icon: string;
  title: string;
  subtitle?: string;
  pill: string;
  earned: boolean;
  tierLight?: string;
  tierDark?: string;
  amount: string;
  pct: number;
  progressLabel: string;
  dots: Dot[];
  details?: ReactNode;
  isShown: boolean;
  canSelect: boolean;
  onToggle: () => void;
  selecting: boolean;
  selectTestId: string;
}) {
  const Icon = (LucideIcons as any)[props.icon] || Trophy;
  const scope = props.earned ? ({ "--tier-l": props.tierLight, "--tier-d": props.tierDark } as CSSProperties) : undefined;
  return (
    <div
      className={`level-card relative rounded-lg border bg-card p-3 ${props.isShown ? "border-primary ring-1 ring-primary" : "border-primary/20"}`}
      style={scope}
      data-testid={props.testId}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 ${props.earned ? "tier-ring" : "border-border bg-muted"}`}
        >
          {props.earned ? (
            <Icon className="tier-color h-5 w-5" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-serif text-[0.95rem] font-semibold leading-tight text-foreground">{props.title}</h4>
              {props.subtitle && <p className="font-ui text-[0.7rem] text-muted-foreground">{props.subtitle}</p>}
            </div>
            <span
              className={`font-ui flex-shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] ${props.earned ? "tier-pill" : "bg-muted text-muted-foreground"}`}
              data-testid={`${props.testId}-level`}
            >
              {props.pill}
            </span>
          </div>
          <p className="font-ui mt-0.5 text-xs tabular-nums text-primary" data-testid={`${props.testId}-amount`}>
            {props.amount}
          </p>
          <div className="level-track mt-2 h-1.5 w-full overflow-hidden rounded-full">
            <div className="level-fill h-full rounded-full" style={{ width: `${props.pct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-ui text-[0.68rem] text-muted-foreground">{props.progressLabel}</p>
            <div className="flex flex-shrink-0 gap-1" aria-label="Levels">
              {props.dots.map((d) => (
                <span
                  key={d.key}
                  title={d.title}
                  className={`level-card h-2 w-2 rounded-full ${d.on ? "" : "level-dot-off"}`}
                  style={d.on ? ({ "--tier-l": d.light, "--tier-d": d.dark, background: "var(--tier)" } as CSSProperties) : undefined}
                />
              ))}
            </div>
          </div>
          {props.details}
          {props.canSelect && (
            <button
              type="button"
              className={`font-ui mt-2 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs text-primary ${props.isShown ? "border-primary bg-transparent" : "border-primary/30 bg-background"}`}
              onClick={props.onToggle}
              disabled={props.selecting}
              data-testid={props.selectTestId}
            >
              {props.isShown && <Check className="h-3 w-3" />}
              {props.isShown ? "Shown · Hide" : "Show on avatar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const SectionTitle = ({ title, right }: { title: string; right?: string }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
    <h3 className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h3>
    {right && <p className="font-ui text-[0.65rem] text-muted-foreground" data-testid="text-tier-ladder">{right}</p>}
  </div>
);

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
      <SectionTitle
        title="Skill tiers"
        right={XP_TIERS.map((t) => `${t.name} ${t.minXp >= 1000 ? `${t.minXp / 1000}k` : t.minXp}`).join(" · ")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map((s) => {
          const floor = s.tier?.minXp ?? 0;
          const ceil = s.nextTier?.minXp ?? floor;
          const pct = s.nextTier ? Math.max(0, Math.min(100, ((s.xp - floor) / (ceil - floor)) * 100)) : 100;
          const tierIdx = s.tier ? XP_TIERS.findIndex((t) => t.id === s.tier!.id) : -1;
          const isShown = !!s.tierBadgeId && s.tierBadgeId === selectedBadgeId;
          const t = s.tier ? XP_TIERS.find((x) => x.id === s.tier!.id) : undefined;
          return (
            <LevelCard
              key={s.id}
              testId={`skill-${s.id}`}
              icon={s.icon}
              title={s.name}
              pill={s.tier ? s.tier.name : "Unranked"}
              earned={!!s.tier}
              tierLight={t?.color}
              tierDark={t?.darkColor}
              amount={`${fmt(s.xp)} XP`}
              pct={pct}
              progressLabel={s.nextTier ? `${fmt(s.nextTier.minXp - s.xp)} XP to ${s.nextTier.name}` : "Top tier reached"}
              dots={XP_TIERS.map((x, i) => ({ key: x.id, title: `${x.name}: ${fmt(x.minXp)} XP`, on: i <= tierIdx, light: x.color, dark: x.darkColor }))}
              details={
                <details className="mt-1.5">
                  <summary className="font-ui cursor-pointer select-none text-[0.68rem] text-primary">How to earn</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[0.68rem] text-muted-foreground">
                    {s.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </details>
              }
              isShown={isShown}
              canSelect={isOwnProfile && !!s.tierBadgeId}
              onToggle={() => onSelect(isShown ? null : s.tierBadgeId)}
              selecting={selecting}
              selectTestId={`button-select-skill-${s.id}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Milestone badges: every badge sharing a requirementType is one badge with levels. */
export function MilestoneBadges({
  badges,
  isOwnProfile,
  onSelect,
  selecting,
}: {
  badges: any[];
  isOwnProfile: boolean;
  onSelect: (badgeId: string | null) => void;
  selecting: boolean;
}) {
  const stacks = new Map<string, any[]>();
  for (const b of badges) {
    const k = b.requirementType || b.badgeId;
    if (!stacks.has(k)) stacks.set(k, []);
    stacks.get(k)!.push(b);
  }
  const list = Array.from(stacks.entries()).map(([type, levels]) => {
    levels.sort((a, b) => a.requirement - b.requirement || a.tier - b.tier);
    const earned = levels.filter((l) => l.unlockedAt);
    const current = earned[earned.length - 1] ?? null;
    const next = levels.find((l) => !l.unlockedAt) ?? null;
    return { type, levels, current, next, earnedCount: earned.length };
  });
  // Stacks with progress first, then by how far along they are.
  list.sort((a, b) => b.earnedCount / b.levels.length - a.earnedCount / a.levels.length);
  if (list.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-milestones">
      <SectionTitle title="Milestones" />
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map(({ type, levels, current, next, earnedCount }) => {
          const meta = BADGE_STACKS[type] ?? { name: levels[0].name, unit: "" };
          const total = levels.length;
          const focus = next ?? current;
          const cur = Math.max(0, focus?.progress?.current ?? 0);
          const req = Math.max(1, next?.progress?.required ?? current?.progress?.required ?? 1);
          const prevReq = current?.requirement ?? 0;
          const span = Math.max(1, req - prevReq);
          const pct = next ? Math.max(0, Math.min(100, ((cur - prevReq) / span) * 100)) : 100;
          const isShown = levels.some((l) => l.isSelected);
          const showIcon = (current ?? levels[0]).icon;
          const unit = meta.unit ? ` ${meta.unit}` : "";
          // Founding Member is a one-off numbered badge, not a progress stack.
          const founderNo = type === "founder" ? (current?.name?.match(/#(\d+)/)?.[1] ?? null) : null;
          return (
            <LevelCard
              key={type}
              testId={`badge-stack-${type}`}
              icon={showIcon}
              title={meta.name}
              subtitle={current ? current.name : `Next: ${levels[0].name}`}
              pill={type === "founder" ? "First 100" : earnedCount > 0 ? `Level ${earnedCount} of ${total}` : `0 of ${total}`}
              earned={earnedCount > 0}
              tierLight={GOLD_L}
              tierDark={GOLD_D}
              amount={founderNo ? `#${founderNo}` : `${fmt(cur)}${unit}`}
              pct={pct}
              progressLabel={type === "founder" ? "Numbered and never issued again" : next ? `Level ${earnedCount + 1}: ${next.description}` : "All levels earned"}
              dots={levels.map((l, i) => ({
                key: l.badgeId,
                title: `Level ${i + 1}: ${l.name}`,
                on: !!l.unlockedAt,
                light: GOLD_L,
                dark: GOLD_D,
              }))}
              isShown={isShown}
              canSelect={isOwnProfile && !!current}
              onToggle={() => onSelect(isShown ? null : current?.badgeId ?? null)}
              selecting={selecting}
              selectTestId={`button-select-badge-stack-${type}`}
            />
          );
        })}
      </div>
    </div>
  );
}
