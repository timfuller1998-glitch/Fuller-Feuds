import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Crown, Star, Copy, Check, ChevronDown, ChevronUp, AlertTriangle, Plus, Ban, Sparkles, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { parseServerDate } from "@/lib/dates";
import { RUBRIC_LABELS, RUBRIC_MAX, BEST_PICK_THRESHOLD, FOUNDER_CAP, type RubricKey } from "@shared/founders";

// Admin "Founders" tab (Fuller Feuds Dev, Nov 20 2026): site switches, applications with suggested scores and best
// picks (Timothy decides), acceptance messages to send by hand, invite codes and the Saturday showcase.

type Invite = { code: string; link: string; usedAt?: string | null; revoked?: boolean; usedByHandle?: string | null; founderNumber?: number | null; message: { subject: string; body: string } };
type App = {
  id: string; displayName: string; email: string; refSource: string | null; heardAbout: string | null; whereDebate: string | null;
  profileLinks: string | null; interests: string[]; politics: string | null; religion: string | null; steelmanPrompt: string | null;
  steelman: string; mindChange: string; frequency: string;
  suggested: { rubric?: Record<RubricKey, number>; ai?: Record<RubricKey, number> | null } | null;
  suggestedTotal: number | null; scoreMethod: string | null; aiNotes: string | null; adminScore: number | null; adminNote: string | null;
  status: string; redFlags: string[]; notes: string[]; bestPick: boolean; createdAt: string; reviewedAt: string | null; reviewedBy: string | null;
  invite: Invite | null;
};
type Mix = { count: number; politics: Record<string, number>; religion: Record<string, number> };
type AppsResponse = { items: App[]; counts: Record<string, number>; mix: { accepted: Mix; bestPicks: Mix } };
type Settings = { foundingMode: boolean; publicLaunch: boolean; stats: { founders: number; last_number: number; pending: number } };
type Code = { id: string; code: string; kind: string; note: string | null; usedAt: string | null; revoked: boolean; createdAt: string; ownerHandle: string | null; ownerFounderNumber: number | null; usedByHandle: string | null; usedByFounderNumber: number | null };
type PublicDebate = { id: string; topicTitle: string; participant1Name: string; participant2Name: string; status: string; isShowcase: boolean };

const FREQ: Record<string, string> = { weekly: "Weekly", monthly: "Few times a month", occasionally: "Occasionally" };
const ago = (d: string | null) => (d ? formatDistanceToNow(parseServerDate(d), { addSuffix: true }) : "");

async function send(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || "Request failed");
  return j;
}

function CopyButton({ text, label, testId }: { text: string; label: string; testId: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm" variant="outline" data-testid={testId}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}
    >
      {done ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}{done ? "Copied" : label}
    </Button>
  );
}

/** Ready-to-send acceptance email; Timothy copies it into his own mail. */
export function AcceptanceMessageDialog({ invite, name, email, onClose }: { invite: Invite | null; name: string; email: string; onClose: () => void }) {
  return (
    <Dialog open={!!invite} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto" data-testid="dialog-acceptance-message">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Acceptance message{name ? ` for ${name}` : ""}</DialogTitle>
          <DialogDescription>Nothing is sent automatically. Copy this into an email to {email || "them"} and send it yourself.</DialogDescription>
        </DialogHeader>
        {invite ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-ui text-xs uppercase tracking-[0.12em] text-muted-foreground">Code</span>
              <span className="font-mono text-lg font-semibold" data-testid="text-acceptance-code">{invite.code}</span>
              <CopyButton text={invite.code} label="Copy code" testId="button-copy-code" />
              <CopyButton text={invite.link} label="Copy link" testId="button-copy-link" />
            </div>
            {email ? (
              <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground w-16">To</span><span className="text-sm font-medium">{email}</span><CopyButton text={email} label="Copy" testId="button-copy-email" /></div>
            ) : null}
            <div className="space-y-1">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Subject</span><CopyButton text={invite.message.subject} label="Copy subject" testId="button-copy-subject" /></div>
              <Input readOnly value={invite.message.subject} data-testid="input-acceptance-subject" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Body</span><CopyButton text={invite.message.body} label="Copy body" testId="button-copy-body" /></div>
              <Textarea readOnly value={invite.message.body} rows={16} className="font-mono text-xs" data-testid="input-acceptance-body" />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MixLine({ label, mix }: { label: string; mix: Mix }) {
  const p = mix.politics, r = mix.religion;
  return (
    <div className="text-xs text-muted-foreground" data-testid={`mix-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <span className="font-semibold text-foreground">{label} ({mix.count}):</span>{" "}
      Left {p.left} · Center/other {p.center} · Right {p.right} · Skipped {p.unknown}
      <span className="mx-2">|</span>
      Religious {r.religious} · Not religious {r.nonreligious} · Unsure {r.unsure} · Skipped {r.unknown}
    </div>
  );
}

function ScoreGrid({ a }: { a: App }) {
  const rubric = a.suggested?.rubric;
  const ai = a.suggested?.ai;
  const keys = Object.keys(RUBRIC_MAX) as RubricKey[];
  return (
    <div className="grid grid-cols-[auto_repeat(2,minmax(0,4rem))] gap-x-3 gap-y-0.5 text-xs" data-testid={`scores-${a.id}`}>
      <span />
      <span className="text-muted-foreground">Rubric</span>
      <span className="text-muted-foreground">AI</span>
      {keys.map((k) => (
        <div key={k} className="contents">
          <span>{RUBRIC_LABELS[k]}</span>
          <span className="tabular-nums">{rubric?.[k] ?? "–"} / {RUBRIC_MAX[k]}</span>
          <span className="tabular-nums text-muted-foreground">{ai ? `${ai[k]} / ${RUBRIC_MAX[k]}` : "–"}</span>
        </div>
      ))}
    </div>
  );
}

function ApplicationCard({ a, onDecided }: { a: App; onDecided: (a: App, invite: Invite | null) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<string>(a.adminScore != null ? String(a.adminScore) : "");
  const [note, setNote] = useState(a.adminNote ?? "");
  const decide = useMutation({
    mutationFn: (status: string) => send("PATCH", `/api/admin/founders/applications/${a.id}`, {
      status, adminScore: score.trim() === "" ? null : Math.max(0, Math.min(15, Number(score) || 0)), adminNote: note.trim() || null,
    }),
    onSuccess: (j, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/codes"] });
      if (status === "accepted" && j.invite) onDecided(a, j.invite);
      else toast({ title: status === "declined" ? "Declined" : status === "waitlisted" ? "Waitlisted" : "Saved" });
    },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });
  const rescore = useMutation({
    mutationFn: () => send("POST", `/api/admin/founders/applications/${a.id}/rescore`),
    onSuccess: (j) => { toast({ title: j.ok ? "AI scores added" : "AI scoring unavailable", description: j.message }); queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/applications"] }); },
  });
  const total = a.adminScore ?? a.suggestedTotal ?? 0;
  const statusTone = a.status === "accepted" ? "bg-emerald-700 text-white" : a.status === "declined" ? "bg-muted text-muted-foreground" : a.status === "waitlisted" ? "bg-amber-600 text-white" : "";

  return (
    <Card className={a.bestPick ? "border-2 border-[hsl(var(--gold))]" : "border-foreground/20"} data-testid={`application-${a.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-lg font-bold" data-testid={`text-applicant-${a.id}`}>{a.displayName}</h3>
              {a.bestPick ? (
                <Badge className="gap-1 bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]" data-testid={`badge-best-pick-${a.id}`}><Star className="w-3 h-3" /> Best pick</Badge>
              ) : null}
              <Badge variant="secondary" className={statusTone} data-testid={`badge-status-${a.id}`}>{a.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {a.email} · applied {ago(a.createdAt)}{a.refSource ? ` · via ${a.refSource}` : ""}{a.reviewedBy ? ` · reviewed by @${a.reviewedBy}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif text-2xl font-bold tabular-nums" data-testid={`text-score-${a.id}`}>{total}<span className="text-sm text-muted-foreground"> / 15</span></div>
            <div className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">
              {a.adminScore != null ? "your score" : a.scoreMethod === "ai" ? "AI suggested" : "rubric suggested"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {a.interests.map((i) => <Badge key={i} variant="outline">{i}</Badge>)}
          <Badge variant="outline">{FREQ[a.frequency] ?? a.frequency}</Badge>
          <Badge variant="outline" data-testid={`badge-politics-${a.id}`}>Politics: {a.politics ?? "skipped"}</Badge>
          <Badge variant="outline">Religion: {a.religion ?? "skipped"}</Badge>
        </div>

        {a.redFlags.length ? (
          <ul className="text-xs text-destructive space-y-0.5" data-testid={`red-flags-${a.id}`}>
            {a.redFlags.map((f) => <li key={f} className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {f}</li>)}
          </ul>
        ) : null}
        {a.notes.length ? <p className="text-xs text-muted-foreground">Notes: {a.notes.join(" · ")}</p> : null}
        {a.aiNotes ? <p className="text-xs text-muted-foreground italic">AI: {a.aiNotes}</p> : null}

        <button type="button" className="text-sm underline underline-offset-2 flex items-center gap-1" onClick={() => setOpen((o) => !o)} data-testid={`button-toggle-answers-${a.id}`}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {open ? "Hide answers" : "Read answers & scores"}
        </button>
        {open ? (
          <div className="space-y-3 border-t pt-3 text-sm" data-testid={`answers-${a.id}`}>
            <ScoreGrid a={a} />
            <div><p className="font-semibold">Steelman{a.steelmanPrompt ? `: ${a.steelmanPrompt}` : ""}</p><p className="whitespace-pre-wrap text-muted-foreground">{a.steelman}</p></div>
            <div><p className="font-semibold">Changed their mind</p><p className="whitespace-pre-wrap text-muted-foreground">{a.mindChange}</p></div>
            {a.whereDebate ? <div><p className="font-semibold">Where they debate</p><p className="whitespace-pre-wrap text-muted-foreground">{a.whereDebate}</p></div> : null}
            {a.profileLinks ? <div><p className="font-semibold">Links</p><p className="whitespace-pre-wrap text-muted-foreground break-all">{a.profileLinks}</p></div> : null}
            {a.heardAbout ? <div><p className="font-semibold">Heard about us</p><p className="text-muted-foreground">{a.heardAbout}</p></div> : null}
            <Button size="sm" variant="ghost" onClick={() => rescore.mutate()} disabled={rescore.isPending} data-testid={`button-rescore-${a.id}`}>
              <Sparkles className="w-4 h-4 mr-1" /> Ask AI for a second opinion
            </Button>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[6rem_1fr] items-start border-t pt-3">
          <Input type="number" min={0} max={15} placeholder={`Score`} value={score} onChange={(e) => setScore(e.target.value)} aria-label="Your final score out of 15" data-testid={`input-admin-score-${a.id}`} />
          <Input placeholder="Private note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} data-testid={`input-admin-note-${a.id}`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => decide.mutate("accepted")} disabled={decide.isPending} data-testid={`button-accept-${a.id}`}>
            <Crown className="w-4 h-4 mr-1" /> {a.status === "accepted" ? "Accepted" : "Accept"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide.mutate("waitlisted")} disabled={decide.isPending} data-testid={`button-waitlist-${a.id}`}>Waitlist</Button>
          <Button size="sm" variant="outline" onClick={() => decide.mutate("declined")} disabled={decide.isPending} data-testid={`button-decline-${a.id}`}>Decline</Button>
          {a.invite ? (
            <Button size="sm" variant="ghost" onClick={() => onDecided(a, a.invite)} data-testid={`button-show-message-${a.id}`}>
              <Mail className="w-4 h-4 mr-1" /> Acceptance message
            </Button>
          ) : null}
        </div>
        {a.invite ? (
          <p className="text-xs text-muted-foreground" data-testid={`text-invite-${a.id}`}>
            Code <span className="font-mono">{a.invite.code}</span>{" "}
            {a.invite.usedByHandle ? `· used by @${a.invite.usedByHandle}${a.invite.founderNumber ? ` (Founder #${a.invite.founderNumber})` : ""}` : a.invite.revoked ? "· revoked" : "· not used yet"}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FoundingMembers() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("new");
  const [shown, setShown] = useState<{ invite: Invite; name: string; email: string } | null>(null);
  const [codeNote, setCodeNote] = useState("");

  const settings = useQuery<Settings>({ queryKey: ["/api/admin/founders/settings"] });
  const apps = useQuery<AppsResponse>({ queryKey: ["/api/admin/founders/applications"] });
  const codes = useQuery<Code[]>({ queryKey: ["/api/admin/founders/codes"] });
  const showcase = useQuery<{ live: PublicDebate[]; finished: PublicDebate[] }>({ queryKey: ["/api/admin/founders/showcase"] });

  const setSwitch = useMutation({
    mutationFn: (body: Partial<Pick<Settings, "foundingMode" | "publicLaunch">>) => send("PUT", "/api/admin/founders/settings", body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/settings"] }); queryClient.invalidateQueries({ queryKey: ["/api/site-config"] }); },
    onError: (e: Error) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });
  const createCode = useMutation({
    mutationFn: () => send("POST", "/api/admin/founders/codes", { note: codeNote }),
    onSuccess: (j) => { queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/codes"] }); setShown({ invite: j, name: codeNote, email: "" }); setCodeNote(""); },
    onError: (e: Error) => toast({ title: "Couldn't create a code", description: e.message, variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => send("POST", `/api/admin/founders/codes/${id}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/codes"] }),
    onError: (e: Error) => toast({ title: "Couldn't revoke", description: e.message, variant: "destructive" }),
  });
  const feature = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => send("PUT", `/api/admin/founders/showcase/${id}`, { isShowcase: on }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/founders/showcase"] }),
  });

  const items = (apps.data?.items ?? []).filter((a) => filter === "all" || (filter === "best" ? a.bestPick : a.status === filter));
  const counts = apps.data?.counts ?? {};
  const bestCount = (apps.data?.items ?? []).filter((a) => a.bestPick).length;
  const s = settings.data;
  const FILTERS: Array<[string, string]> = [["new", `New (${counts.new ?? 0})`], ["best", `Best picks (${bestCount})`], ["accepted", `Accepted (${counts.accepted ?? 0})`], ["waitlisted", `Waitlisted (${counts.waitlisted ?? 0})`], ["declined", `Declined (${counts.declined ?? 0})`], ["all", "All"]];

  return (
    <div className="space-y-4" data-testid="admin-founders">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-[hsl(var(--gold))]" /> Founding members</CardTitle>
          <CardDescription>
            {s ? `${s.stats.founders} of ${FOUNDER_CAP} founders · ${s.stats.pending} applications waiting` : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Founding mode (invite-only sign-up)</p>
              <p className="text-xs text-muted-foreground">New accounts need a single-use invite code. Existing accounts sign in as normal.</p>
            </div>
            <Switch checked={!!s?.foundingMode} disabled={!s || setSwitch.isPending} onCheckedChange={(v) => setSwitch.mutate({ foundingMode: v })} data-testid="switch-founding-mode" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Public launch</p>
              <p className="text-xs text-muted-foreground">Turns on founders' lifetime ad-free. Until then founders see ads like everyone else.</p>
            </div>
            <Switch checked={!!s?.publicLaunch} disabled={!s || setSwitch.isPending} onCheckedChange={(v) => setSwitch.mutate({ publicLaunch: v })} data-testid="switch-public-launch" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            Every applicant with my suggested score out of 15. Gold cards are my best picks ({BEST_PICK_THRESHOLD}+ with no red flags).
            You make the final call. Accepting creates an invite code and a message for you to send yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {apps.data ? (
            <div className="space-y-1 border-l-2 border-[hsl(var(--gold))] pl-3">
              <MixLine label="Accepted" mix={apps.data.mix.accepted} />
              <MixLine label="Best picks" mix={apps.data.mix.bestPicks} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2" data-testid="filters-applications">
            {FILTERS.map(([v, label]) => (
              <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)} data-testid={`filter-${v}`}>{label}</Button>
            ))}
          </div>
          {apps.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {apps.data && items.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center" data-testid="empty-applications">No applications here yet.</p> : null}
          <div className="space-y-3">
            {items.map((a) => <ApplicationCard key={a.id} a={a} onDecided={(app, invite) => invite && setShown({ invite, name: app.displayName, email: app.email })} />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite codes</CardTitle>
          <CardDescription>Make a code for someone you're inviting directly (your own network). Each works once and records who invited whom.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Who is it for? (name or note)" value={codeNote} onChange={(e) => setCodeNote(e.target.value)} maxLength={200} data-testid="input-code-note" />
            <Button onClick={() => createCode.mutate()} disabled={createCode.isPending} data-testid="button-create-code"><Plus className="w-4 h-4 mr-1" /> Create code</Button>
          </div>
          <div className="divide-y border border-foreground/15" data-testid="list-invite-codes">
            {(codes.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground p-3">No codes yet.</p> : null}
            {(codes.data ?? []).map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`code-${c.code}`}>
                <div className="min-w-0">
                  <span className={`font-mono ${c.revoked ? "line-through text-muted-foreground" : ""}`}>{c.code}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {c.kind === "founder" ? `Founder #${c.ownerFounderNumber ?? "?"}'s code` : c.kind === "acceptance" ? "Application" : "Direct"}
                    {c.note && c.kind !== "founder" ? ` · ${c.note}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {c.usedByHandle ? <span>used by @{c.usedByHandle}{c.usedByFounderNumber ? ` (#${c.usedByFounderNumber})` : ""}</span> : c.revoked ? <span>revoked</span> : <span>unused</span>}
                  {!c.usedAt && !c.revoked ? (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(c.id)} data-testid={`button-revoke-${c.code}`}><Ban className="w-3.5 h-3.5 mr-1" /> Revoke</Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-[hsl(var(--gold))]" /> Saturday showcase</CardTitle>
          <CardDescription>Feature a public debate at the top of the Live page with a Showcase label.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...(showcase.data?.live ?? []), ...(showcase.data?.finished ?? [])].length === 0 ? (
            <p className="text-sm text-muted-foreground">No public debates yet. Start one with a Challenge, then feature it here.</p>
          ) : null}
          {[...(showcase.data?.live ?? []), ...(showcase.data?.finished ?? [])].map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 border border-foreground/15 px-3 py-2" data-testid={`showcase-row-${d.id}`}>
              <div className="min-w-0 text-sm">
                <div className="font-medium truncate">{d.topicTitle}</div>
                <div className="text-xs text-muted-foreground">{d.participant1Name} vs {d.participant2Name} · {d.status === "active" ? "live" : "finished"}</div>
              </div>
              <Switch checked={d.isShowcase} onCheckedChange={(on) => feature.mutate({ id: d.id, on })} aria-label="Showcase" data-testid={`switch-showcase-${d.id}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <AcceptanceMessageDialog invite={shown?.invite ?? null} name={shown?.name ?? ""} email={shown?.email ?? ""} onClose={() => setShown(null)} />
    </div>
  );
}
