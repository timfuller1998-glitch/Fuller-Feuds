import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Crown, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FOUNDER_INVITE_CODES } from "@shared/founders";

type MyFounder = {
  founderNumber: number | null;
  codes: { code: string; link: string; used: boolean; usedByHandle: string | null; revoked: boolean }[];
};

/** Settings card for founding members: number, invite codes to share, Founders' Room link. */
export function FounderCard({ founderNumber, publicLaunch }: { founderNumber: number; publicLaunch: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const { data } = useQuery<MyFounder>({
    queryKey: ["/api/founders/me"],
    queryFn: async () => {
      const res = await fetch("/api/founders/me", { credentials: "include" });
      if (!res.ok) throw new Error("founder");
      return res.json();
    },
  });
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast({ title: "Couldn't copy", description: text });
    }
  };
  const codes = data?.codes ?? [];

  return (
    <Card className="border-[hsl(var(--gold))]" data-testid="card-settings-founder">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[hsl(var(--gold))]" />
          Founding Member #{founderNumber}
        </CardTitle>
        <CardDescription>
          You're one of the first members setting the tone here. Thank you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="text-sm space-y-1 list-disc pl-5">
          <li>
            <Link href="/founders" className="underline underline-offset-2" data-testid="link-founders-room">Founders' Room</Link>: talk shop with the other founders.
          </li>
          <li data-testid="text-founder-adfree">
            Lifetime ad-free: {publicLaunch ? "active. Use the switch below." : "switches on when Fuller Feuds publicly launches."}
          </li>
        </ul>
        {codes.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your invite codes ({codes.filter((c) => !c.used && !c.revoked).length} of {codes.length} left)</p>
            <p className="text-xs text-muted-foreground">Each works once. Give them to people you'd trust to argue in good faith.</p>
            <div className="space-y-2">
              {codes.map((c) => (
                <div key={c.code} className="flex items-center justify-between gap-2 border border-foreground/15 px-3 py-2" data-testid={`row-invite-${c.code}`}>
                  <div className="min-w-0">
                    <span className={`font-mono text-sm ${c.used || c.revoked ? "line-through text-muted-foreground" : ""}`}>{c.code}</span>
                    {c.used ? <span className="text-xs text-muted-foreground ml-2">used{c.usedByHandle ? ` by @${c.usedByHandle}` : ""}</span> : null}
                    {c.revoked ? <span className="text-xs text-muted-foreground ml-2">revoked</span> : null}
                  </div>
                  {!c.used && !c.revoked ? (
                    <Button size="sm" variant="outline" onClick={() => copy(c.link, c.code)} data-testid={`button-copy-invite-${c.code}`}>
                      {copied === c.code ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copied === c.code ? "Copied" : "Copy link"}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : data ? (
          <p className="text-xs text-muted-foreground">
            Founders admitted through an application get {FOUNDER_INVITE_CODES} invite codes. Ask Timothy if you'd like some.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
