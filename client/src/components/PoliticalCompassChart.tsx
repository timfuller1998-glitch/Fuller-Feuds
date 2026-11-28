import { useState } from "react";
import { compassExtent, confidenceRadius, type Confidence } from "@shared/compassDescription";
import { COMPASS_AXIS, COMPASS_QUADRANTS } from "@shared/politicalCompass";

interface PoliticalCompassChartProps {
  economicScore: number;
  authoritarianScore: number;
  confidence?: Confidence;
  /** "sm" hides the zoom toggle and outer labels, for compact reuse. */
  size?: "sm" | "md" | "lg";
  markerLabel?: string;
  className?: string;
}

// Plot area in SVG units; labels sit in the padding around it.
const P = 32;
const W = 240;
const TOTAL = W + P * 2;

const QUADRANTS = [
  { x: 0, y: 0, color: COMPASS_QUADRANTS.authoritarianLiberal.hex, label: COMPASS_QUADRANTS.authoritarianLiberal.shortLabel },
  { x: 1, y: 0, color: COMPASS_QUADRANTS.authoritarianConservative.hex, label: COMPASS_QUADRANTS.authoritarianConservative.shortLabel },
  { x: 0, y: 1, color: COMPASS_QUADRANTS.libertarianLiberal.hex, label: COMPASS_QUADRANTS.libertarianLiberal.shortLabel },
  { x: 1, y: 1, color: COMPASS_QUADRANTS.libertarianConservative.hex, label: COMPASS_QUADRANTS.libertarianConservative.shortLabel },
];

const fmt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(Math.round(v))}`;

export function PoliticalCompassChart({
  economicScore,
  authoritarianScore,
  confidence,
  size = "md",
  markerLabel,
  className = "",
}: PoliticalCompassChartProps) {
  const e = Math.max(-100, Math.min(100, economicScore ?? 0));
  const a = Math.max(-100, Math.min(100, authoritarianScore ?? 0));
  const fitted = compassExtent(e, a);
  const [full, setFull] = useState(false);
  const extent = full ? 100 : fitted;
  const zoomed = extent < 100;

  const toX = (v: number) => P + ((v + extent) / (2 * extent)) * W;
  const toY = (v: number) => P + ((extent - v) / (2 * extent)) * W;
  const unit = W / (2 * extent);
  const step = extent <= 30 ? 5 : extent <= 60 ? 10 : 25;
  const ticks: number[] = [];
  for (let t = -extent + step; t < extent; t += step) if (t !== 0) ticks.push(t);
  const halo = confidenceRadius(confidence);
  const cx = toX(e);
  const cy = toY(a);
  const half = W / 2;
  const compact = size === "sm";
  const maxW = size === "lg" ? "max-w-[420px]" : compact ? "max-w-[200px]" : "max-w-[340px]";

  return (
    <div className={`w-full ${maxW} mx-auto ${className}`} data-testid="political-compass">
      <svg
        viewBox={`0 0 ${TOTAL} ${TOTAL}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label={`Political compass: economic ${fmt(e)}, social ${fmt(a)}`}
      >
        {QUADRANTS.map((q) => (
          <rect key={q.label} x={P + q.x * half} y={P + q.y * half} width={half} height={half} fill={q.color} fillOpacity={0.09} />
        ))}
        {ticks.map((t) => (
          <g key={t} stroke="hsl(var(--border))" strokeWidth={0.6} strokeOpacity={0.7}>
            <line x1={toX(t)} y1={P} x2={toX(t)} y2={P + W} />
            <line x1={P} y1={toY(t)} x2={P + W} y2={toY(t)} />
          </g>
        ))}
        <rect x={P} y={P} width={W} height={W} fill="none" stroke="hsl(var(--border))" strokeWidth={1} rx={3} />
        <line x1={P + half} y1={P} x2={P + half} y2={P + W} stroke="hsl(var(--foreground))" strokeOpacity={0.35} strokeWidth={1} />
        <line x1={P} y1={P + half} x2={P + W} y2={P + half} stroke="hsl(var(--foreground))" strokeOpacity={0.35} strokeWidth={1} />

        {!compact &&
          QUADRANTS.map((q) => (
            <text
              key={`l-${q.label}`}
              x={P + q.x * half + (q.x ? half - 6 : 6)}
              y={P + q.y * half + (q.y ? half - 6 : 12)}
              textAnchor={q.x ? "end" : "start"}
              className="font-ui"
              fontSize={6.5}
              letterSpacing={0.4}
              fill={q.color}
              fillOpacity={0.85}
            >
              {q.label.toUpperCase()}
            </text>
          ))}

        <g className="font-ui" fontSize={8} fontWeight={600} letterSpacing={0.8} fill="hsl(var(--muted-foreground))">
          <text x={P + half} y={P - 9} textAnchor="middle">{COMPASS_AXIS.authoritarian.toUpperCase()}</text>
          <text x={P + half} y={P + W + 16} textAnchor="middle">{COMPASS_AXIS.libertarian.toUpperCase()}</text>
          <text x={P - 9} y={P + half} textAnchor="middle" transform={`rotate(-90 ${P - 9} ${P + half})`}>{COMPASS_AXIS.liberal.toUpperCase()}</text>
          <text x={P + W + 9} y={P + half} textAnchor="middle" transform={`rotate(90 ${P + W + 9} ${P + half})`}>{COMPASS_AXIS.conservative.toUpperCase()}</text>
        </g>
        {!compact && (
          <g className="font-ui" fontSize={6.5} fill="hsl(var(--muted-foreground))" fillOpacity={0.8}>
            <text x={P + 3} y={P + half + 9}>−{extent}</text>
            <text x={P + W - 3} y={P + half + 9} textAnchor="end">+{extent}</text>
          </g>
        )}

        {halo != null && (
          <circle
            cx={cx}
            cy={cy}
            r={Math.max(halo * unit, 9)}
            fill="hsl(var(--primary))"
            fillOpacity={0.14}
            stroke="hsl(var(--primary))"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
            strokeWidth={1}
            data-testid="compass-halo"
          />
        )}
        <line x1={P + half} y1={P + half} x2={cx} y2={cy} stroke="hsl(var(--primary))" strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 2" />
        <circle cx={cx} cy={cy} r={6.5} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2.5} data-testid="compass-marker" />
        {!compact && (
          <text
            x={cx + (cx > P + W - 60 ? -10 : 10)}
            y={cy + (cy < P + 16 ? 14 : -9)}
            textAnchor={cx > P + W - 60 ? "end" : "start"}
            className="font-ui"
            fontSize={8.5}
            fontWeight={700}
            fill="hsl(var(--foreground))"
            paintOrder="stroke"
            stroke="hsl(var(--card))"
            strokeWidth={3}
          >
            {markerLabel ? `${markerLabel} ` : ""}({fmt(e)}, {fmt(a)})
          </text>
        )}
      </svg>
      {!compact && (
        <div className="mt-1 flex items-center justify-center gap-2 font-ui text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
          {zoomed && (
            <span className="rounded-full border border-border px-2 py-0.5" data-testid="compass-zoom-indicator">
              Zoomed to ±{extent}
            </span>
          )}
          {fitted < 100 && (
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-primary hover:underline"
              onClick={() => setFull((v) => !v)}
              data-testid="button-compass-zoom"
            >
              {full ? "Zoom in" : "Full ±100 view"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
