// Deterministic, neutral plain-language reading of a political compass position.
// Orientation matches the chart: economic < 0 = Left, > 0 = Right; social > 0 = Authoritarian, < 0 = Libertarian.

export type Confidence = "low" | "medium" | "high" | string | null | undefined;

export interface CompassReading {
  region: string;
  summary: string;
  basis: string;
}

const clamp = (v: number) => Math.max(-100, Math.min(100, Number.isFinite(v) ? v : 0));

/** Degree word for one axis value (absolute). */
export function degree(abs: number): "" | "slightly" | "moderately" | "clearly" | "strongly" | "very strongly" {
  if (abs < 5) return "";
  if (abs < 15) return "slightly";
  if (abs < 30) return "moderately";
  if (abs < 60) return "clearly";
  if (abs < 85) return "strongly";
  return "very strongly";
}

function regionName(e: number, s: number): string {
  const ae = Math.abs(e), as = Math.abs(s);
  const econ = e < 0 ? "left" : "right";
  const soc = s > 0 ? "authoritarian" : "libertarian";
  if (ae < 15 && as < 15) {
    const parts = [
      degree(ae) && `${degree(ae)} ${econ}`,
      degree(as) && `${degree(as)} ${soc}`,
    ].filter(Boolean);
    return parts.length ? `Centrist, leaning ${parts.join(" and ")}` : "Centrist";
  }
  const intensity = Math.max(ae, as) < 30 ? "Moderate " : Math.max(ae, as) >= 60 ? "Strong " : "";
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  if (ae >= 15 && as >= 15) {
    const q = s > 0 ? `Authoritarian ${cap(econ)}` : `Libertarian ${cap(econ)}`;
    return `${intensity}${q}`;
  }
  if (ae >= 15) {
    const lean = degree(as) ? `, ${degree(as)} ${soc}` : ", socially centrist";
    return `${intensity}${cap(econ)}${lean}`;
  }
  const lean = degree(ae) ? `, ${degree(ae)} ${econ} on economics` : ", economically centrist";
  return `${intensity}${cap(soc)}${lean}`;
}

const ECON = {
  left: "a bigger role for government in the economy, such as public services, regulation and reducing inequality",
  right: "free markets, lower taxes and private enterprise over government involvement in the economy",
  center: "a mix of market and government approaches on economic questions",
};
const SOCIAL = {
  auth: "valuing order, tradition and shared rules, with a stronger role for authority",
  lib: "prioritizing personal freedom and limits on state power over personal choices",
  center: "balancing personal freedom with social order",
};

export function describeCompass(
  economicScore: number,
  authoritarianScore: number,
  opts: { opinions?: number | null; confidence?: Confidence } = {},
): CompassReading {
  const e = clamp(economicScore), s = clamp(authoritarianScore);
  const econ = Math.abs(e) < 15 ? ECON.center : e < 0 ? ECON.left : ECON.right;
  const social = Math.abs(s) < 15 ? SOCIAL.center : s > 0 ? SOCIAL.auth : SOCIAL.lib;
  let summary: string;
  if (Math.abs(e) < 15 && Math.abs(s) < 15) {
    summary = `Views here usually take each issue on its own terms rather than following one side: ${econ}, and ${social}.`;
  } else {
    summary = `People in this area usually favour ${econ}, while ${social}.`;
  }
  if (Math.abs(e) < 15 && Math.abs(s) < 15 && (Math.abs(e) >= 5 || Math.abs(s) >= 5)) {
    summary += " The lean is small, so it reflects a tendency rather than a fixed position.";
  }
  const n = Math.max(0, Math.round(opts.opinions ?? 0));
  const conf = opts.confidence ? String(opts.confidence).toLowerCase() : null;
  let basis = `Based on ${n} opinion${n === 1 ? "" : "s"}`;
  if (conf) basis += ` · ${conf} confidence`;
  basis += ".";
  if (conf === "low" || (n > 0 && n < 5)) basis += " An early read that sharpens as more opinions are shared.";
  return { region: regionName(e, s), summary, basis };
}

/** Half-width of the zoomed view: fits the point with margin, never tighter than ±25. */
export function compassExtent(economicScore: number, authoritarianScore: number): number {
  const m = Math.max(Math.abs(clamp(economicScore)), Math.abs(clamp(authoritarianScore)));
  return Math.min(100, Math.max(25, Math.ceil((m + 10) / 5) * 5));
}

/** Uncertainty radius in score units for the confidence halo. */
export function confidenceRadius(confidence: Confidence): number | null {
  switch (String(confidence ?? "").toLowerCase()) {
    case "low": return 8;
    case "medium": return 5;
    case "high": return 3;
    default: return null;
  }
}
