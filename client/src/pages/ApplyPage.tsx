import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getRef } from "@/lib/ref";
import {
  FOUNDERS_PLEDGE, FREQUENCY_OPTIONS, INTEREST_AREAS, POLITICS_OPTIONS, RELIGION_OPTIONS, STEELMAN_PROMPTS,
  politicsOptionLabel,
} from "@shared/founders";

// Public founding-member application (Fuller Feuds Dev, Nov 20 2026). ~5 minutes, rubric-scored for the admin.

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="font-serif text-base font-semibold">{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground -mt-1">{hint}</p> : null}
      {children}
    </div>
  );
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function ApplyPage() {
  const { toast } = useToast();
  const ref = useMemo(() => getRef(), []);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [heardAbout, setHeardAbout] = useState(ref ? `Link: ${ref}` : "");
  const [whereDebate, setWhereDebate] = useState("");
  const [profileLinks, setProfileLinks] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [politics, setPolitics] = useState<string>("");
  const [religion, setReligion] = useState<string>("");
  const [steelmanPrompt, setSteelmanPrompt] = useState<string>(STEELMAN_PROMPTS[0]);
  const [steelman, setSteelman] = useState("");
  const [mindChange, setMindChange] = useState("");
  const [frequency, setFrequency] = useState<string>("");
  const [is18Plus, setIs18Plus] = useState(false);
  const [pledge, setPledge] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName, email, ref, heardAbout, whereDebate, profileLinks, interests,
          politics: politics || null, religion: religion || null,
          steelmanPrompt, steelman, mindChange, frequency, is18Plus, pledge, website,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Could not send your application");
      return j;
    },
    onSuccess: () => {
      setDone(true);
      document.querySelector("main")?.scrollTo({ top: 0 });
    },
    onError: (e: Error) => toast({ title: "Not sent yet", description: e.message, variant: "destructive" }),
  });

  const toggleInterest = (i: string) =>
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= 3 ? cur : [...cur, i]));

  const steelWords = wordCount(steelman);
  const mindChars = mindChange.trim().length;
  // Plain-language list of what still blocks Send (shown under the button).
  const missing: string[] = [];
  if (displayName.trim().length < 2) missing.push("name");
  if (!/\S+@\S+\.\S+/.test(email)) missing.push("email");
  if (interests.length === 0) missing.push("at least one interest");
  if (steelWords < 8) missing.push("steelman (8+ words)");
  if (mindChars < 20) missing.push("changed-your-mind answer (20+ characters)");
  if (!frequency) missing.push("how often you could debate");
  if (!is18Plus) missing.push("18+ checkbox");
  if (!pledge) missing.push("founders' pledge checkbox");
  const ready = missing.length === 0;

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-1 py-8 text-center space-y-4" data-testid="page-apply-done">
        <CheckCircle2 className="w-12 h-12 mx-auto text-[hsl(var(--gold))]" />
        <h1 className="font-serif text-3xl font-bold">Application received</h1>
        <p className="text-muted-foreground">
          Thanks, {displayName.trim().split(/\s+/)[0]}. We read every application ourselves and admit founding members in small
          weekly waves. If you're in, you'll get an email from Timothy with your invite code.
        </p>
        <Button asChild variant="outline"><Link href="/">Look around while you wait</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-1 pb-10" data-testid="page-apply">
      <header className="border-b-[3px] border-double border-foreground pb-4 mb-6">
        <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--gold))]">Founding members · First 100</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold mt-1" data-testid="heading-apply">Apply to Fuller Feuds</h1>
        <p className="text-muted-foreground mt-2">
          We're hand-picking the first 100 members because they set the culture for everyone after. We're looking for people who
          argue hard and fair, and who can make the other side's case better than their own side does. It takes about 5 minutes.
        </p>
      </header>

      <form
        className="space-y-7"
        onSubmit={(e) => { e.preventDefault(); if (ready) submit.mutate(); }}
        data-testid="form-apply"
      >
        <Card><CardContent className="pt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="apply-name">
              <Input id="apply-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} required data-testid="input-apply-name" />
            </Field>
            <Field label="Email" htmlFor="apply-email">
              <Input id="apply-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} required data-testid="input-apply-email" />
            </Field>
          </div>
          <Field label="Where did you hear about us?" htmlFor="apply-heard">
            <Input id="apply-heard" value={heardAbout} onChange={(e) => setHeardAbout(e.target.value)} maxLength={300} data-testid="input-apply-heard" />
          </Field>
          <Field label="Where do you debate or discuss now?" hint="Forums, Discords, Reddit, a debate team, the dinner table. Links to a profile or a few posts help a lot." htmlFor="apply-where">
            <Textarea id="apply-where" value={whereDebate} onChange={(e) => setWhereDebate(e.target.value)} maxLength={1000} rows={3} data-testid="input-apply-where" />
          </Field>
          <Field label="Profile links (optional)" hint="One per line." htmlFor="apply-links">
            <Textarea id="apply-links" value={profileLinks} onChange={(e) => setProfileLinks(e.target.value)} maxLength={1000} rows={2} placeholder="https://" data-testid="input-apply-links" />
          </Field>
        </CardContent></Card>

        <Card><CardContent className="pt-6 space-y-5">
          <Field label="Pick up to 3 interest areas">
            <div className="flex flex-wrap gap-2" data-testid="group-apply-interests">
              {INTEREST_AREAS.map((i) => {
                const on = interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleInterest(i)}
                    aria-pressed={on}
                    className={`px-3 py-1.5 text-sm border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "border-foreground/25 hover:border-foreground/60"} ${!on && interests.length >= 3 ? "opacity-50" : ""}`}
                    data-testid={`chip-interest-${i.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="border-l-2 border-[hsl(var(--gold))] pl-3 space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-balance-note">
              <span className="font-semibold text-foreground">Optional.</span> These two help us keep the founding group balanced so no
              one side dominates. They're only seen by the people reviewing applications and never shown publicly.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Politically, where do you roughly sit?">
                <Select value={politics} onValueChange={setPolitics}>
                  <SelectTrigger data-testid="select-apply-politics"><SelectValue placeholder="Skip" /></SelectTrigger>
                  <SelectContent>{POLITICS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{politicsOptionLabel(o)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="And on religion?">
                <Select value={religion} onValueChange={setReligion}>
                  <SelectTrigger data-testid="select-apply-religion"><SelectValue placeholder="Skip" /></SelectTrigger>
                  <SelectContent>{RELIGION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-6 space-y-5">
          <Field label="Steelman prompt" hint="Pick one. In about 150 words, make the strongest case for a view you disagree with, so well that its supporters would sign it.">
            <RadioGroup value={steelmanPrompt} onValueChange={setSteelmanPrompt} className="space-y-1" data-testid="group-apply-prompt">
              {STEELMAN_PROMPTS.map((p, i) => (
                <div key={p} className="flex items-start gap-2">
                  <RadioGroupItem value={p} id={`prompt-${i}`} className="mt-0.5" data-testid={`radio-prompt-${i}`} />
                  <Label htmlFor={`prompt-${i}`} className="font-normal leading-snug">{p}</Label>
                </div>
              ))}
            </RadioGroup>
            <Textarea value={steelman} onChange={(e) => setSteelman(e.target.value)} maxLength={4000} rows={8} placeholder="Make their best case…" data-testid="input-apply-steelman" />
            <p className={`text-xs ${steelWords >= 120 ? "text-muted-foreground" : "text-muted-foreground/80"}`} data-testid="text-steelman-words">
              {steelWords} words · needs at least 8 words{steelWords < 120 ? " · aim for about 150" : ""}
            </p>
          </Field>
          <Field label="Tell us about a time you changed your mind on something that mattered." htmlFor="apply-mind">
            <Textarea id="apply-mind" value={mindChange} onChange={(e) => setMindChange(e.target.value)} maxLength={3000} rows={5} data-testid="input-apply-mind" />
            <p className="text-xs text-muted-foreground" data-testid="text-mind-chars">
              Needs at least 20 characters{mindChars < 20 ? ` (${mindChars} so far)` : " ✓"}
            </p>
          </Field>
          <Field label="How often could you realistically debate?">
            <RadioGroup value={frequency} onValueChange={setFrequency} className="flex flex-wrap gap-4" data-testid="group-apply-frequency">
              {FREQUENCY_OPTIONS.map((f) => (
                <div key={f.value} className="flex items-center gap-2">
                  <RadioGroupItem value={f.value} id={`freq-${f.value}`} data-testid={`radio-frequency-${f.value}`} />
                  <Label htmlFor={`freq-${f.value}`} className="font-normal">{f.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </Field>
        </CardContent></Card>

        <Card><CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-2">
            <Checkbox id="apply-18" checked={is18Plus} onCheckedChange={(v) => setIs18Plus(v === true)} data-testid="checkbox-apply-18" />
            <Label htmlFor="apply-18" className="font-normal leading-snug">I'm 18 or older. Founding members must be adults.</Label>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="apply-pledge" checked={pledge} onCheckedChange={(v) => setPledge(v === true)} data-testid="checkbox-apply-pledge" />
            <Label htmlFor="apply-pledge" className="font-normal leading-snug">
              I agree to the founders' pledge: <span className="italic">{FOUNDERS_PLEDGE}</span>
            </Label>
          </div>
          {/* Honeypot for bots; hidden from people and screen readers. */}
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" name="website" />
          <Button type="submit" size="lg" className="w-full" disabled={!ready || submit.isPending} data-testid="button-apply-submit">
            {submit.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Send application"}
          </Button>
          {missing.length > 0 && !submit.isPending && (
            <p className="text-sm text-center text-primary" role="status" data-testid="text-apply-missing">
              Still needed: {missing.join(", ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground text-center">
            We use your answers only to review your application. See our <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
          </p>
        </CardContent></Card>
      </form>
    </div>
  );
}
