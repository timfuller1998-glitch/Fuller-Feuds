/**
 * Traditional political-compass colours and user-facing labels.
 *
 * Axes (unchanged in storage / API): economic −100 liberal … +100 conservative;
 * social −100 libertarian … +100 authoritarian.
 *
 * Colours (Political Compass convention):
 *   authoritarian liberal  (top left)     red
 *   authoritarian conservative (top right) blue
 *   libertarian liberal    (bottom left)  green
 *   libertarian conservative (bottom right) yellow
 */

export interface CompassQuadrantStyle {
  /** User-facing full name, e.g. "Authoritarian Liberal". */
  label: string;
  /** Short chart label, e.g. "Auth Liberal". */
  shortLabel: string;
  /** Chart tint / ink. */
  hex: string;
  /** Hue used by the blended compass-color function. */
  hue: number;
  /** Soft RGB used for card-corner washes. */
  rgb: readonly [number, number, number];
}

export const COMPASS_QUADRANTS = {
  authoritarianLiberal: {
    label: "Authoritarian Liberal",
    shortLabel: "Auth Liberal",
    hex: "#c0392b",
    hue: 0,
    rgb: [255, 120, 130],
  },
  authoritarianConservative: {
    label: "Authoritarian Conservative",
    shortLabel: "Auth Conservative",
    hex: "#2f5d8a",
    hue: 220,
    rgb: [100, 150, 255],
  },
  libertarianLiberal: {
    label: "Libertarian Liberal",
    shortLabel: "Lib Liberal",
    hex: "#3f7d4e",
    hue: 140,
    rgb: [100, 200, 150],
  },
  libertarianConservative: {
    label: "Libertarian Conservative",
    shortLabel: "Lib Conservative",
    hex: "#b8892e",
    hue: 50,
    rgb: [255, 220, 100],
  },
} as const satisfies Record<string, CompassQuadrantStyle>;

export type CompassQuadrantId = keyof typeof COMPASS_QUADRANTS;

export const COMPASS_AXIS = {
  liberal: "Liberal",
  conservative: "Conservative",
  authoritarian: "Authoritarian",
  libertarian: "Libertarian",
  centrist: "Centrist",
} as const;

/** Map a stored API / AI quadrant slug to the label we show people. */
export function displayQuadrantLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  switch (slug) {
    case "authoritarian-socialist":
    case "authoritarian_left":
    case "authoritarian-left":
      return COMPASS_QUADRANTS.authoritarianLiberal.label;
    case "authoritarian-capitalist":
    case "authoritarian_right":
    case "authoritarian-right":
      return COMPASS_QUADRANTS.authoritarianConservative.label;
    case "libertarian-socialist":
    case "libertarian_left":
    case "libertarian-left":
      return COMPASS_QUADRANTS.libertarianLiberal.label;
    case "libertarian-capitalist":
    case "libertarian_right":
    case "libertarian-right":
      return COMPASS_QUADRANTS.libertarianConservative.label;
    case "centrist":
    case "center":
      return COMPASS_AXIS.centrist;
    default:
      return null;
  }
}

export function compassQuadrantId(economicScore: number, authoritarianScore: number): CompassQuadrantId {
  const x = economicScore;
  const y = authoritarianScore;
  if (x < 0 && y >= 0) return "authoritarianLiberal";
  if (x >= 0 && y >= 0) return "authoritarianConservative";
  if (x < 0 && y < 0) return "libertarianLiberal";
  return "libertarianConservative";
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Blended compass colour for a point. Auth-liberal is red, auth-conservative is
 * blue, lib-liberal is green, lib-conservative is yellow.
 */
export function get2DPoliticalCompassColor(
  economicScore: number,
  authoritarianScore: number,
  opts?: { vivid?: boolean },
): string {
  const x = economicScore / 100;
  const y = authoritarianScore / 100;
  const distanceFromCenter = Math.sqrt(x * x + y * y);
  const intensity = Math.min(distanceFromCenter, 1);
  const vivid = !!opts?.vivid;

  const id = compassQuadrantId(economicScore, authoritarianScore);
  let hue: number = COMPASS_QUADRANTS[id].hue;
  let saturation: number = vivid ? 70 + intensity * 25 : 35 + intensity * 15;
  let lightness: number = vivid ? 55 : 75;

  if (distanceFromCenter < 0.15) {
    hue = 38;
    saturation = vivid ? saturation * 0.6 : 22;
    lightness = vivid ? 65 : 84;
  } else if (distanceFromCenter < 0.3) {
    saturation = saturation * (vivid ? 0.8 : 0.7);
    lightness = vivid ? 60 : 80;
  } else if (!vivid) {
    lightness = 75 - intensity * 5;
  }

  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX >= 0.85 || absY >= 0.85) {
    const maxAbsolute = Math.max(absX, absY);
    const extremeFactor = (maxAbsolute - 0.85) / 0.15;
    lightness = lightness * (1 - extremeFactor * 0.4);
    saturation = saturation * (1 + extremeFactor * 0.3);
  }

  return hslToHex(hue, saturation, lightness);
}

/** 1D fallback (legacy single-axis score): liberal is red, conservative is blue. */
export function get1DLeaningColor(score: number): string {
  if (score < -20) return hslToHex(COMPASS_QUADRANTS.authoritarianLiberal.hue, 45, 55);
  if (score <= 20) return hslToHex(38, 18, 62);
  return hslToHex(COMPASS_QUADRANTS.authoritarianConservative.hue, 45, 55);
}
