/**
 * Political gradient utilities for Fuller Feuds.
 * Quadrant colours come from shared/politicalCompass.ts (traditional compass:
 * auth-liberal red, auth-conservative blue, lib-liberal green, lib-conservative yellow).
 */

import { compassQuadrantsFor, get2DPoliticalCompassColor, type CompassColorScheme } from "@shared/politicalCompass";

export { get2DPoliticalCompassColor, COMPASS_QUADRANTS, compassQuadrantsFor } from "@shared/politicalCompass";


export function getOpinionGradientStyle(
  economicScore: number | null | undefined,
  authoritarianScore: number | null | undefined,
  scheme?: CompassColorScheme,
): React.CSSProperties {
  if (economicScore === null || economicScore === undefined ||
      authoritarianScore === null || authoritarianScore === undefined) {
    return {
      background: "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted) / 0.5) 100%)",
    };
  }

  const baseColor = get2DPoliticalCompassColor(economicScore, authoritarianScore, { scheme });
  return {
    background: `linear-gradient(135deg, ${baseColor}2F 0%, ${baseColor}1A 100%)`,
  };
}

export function getTopicCornerGradient(distribution: {
  authoritarianCapitalist: number;  // % of opinions (blue, auth-conservative) — top-right
  authoritarianSocialist: number;   // % of opinions (red, auth-liberal) — top-left
  libertarianCapitalist: number;    // % of opinions (yellow, lib-conservative) — bottom-right
  libertarianSocialist: number;     // % of opinions (green, lib-liberal) — bottom-left
}, scheme?: CompassColorScheme): React.CSSProperties {
  // Quadrant colors - softer, more pastel versions for text legibility
  // Convert percentages (0-100) to reduced opacity (max 0.4 instead of 1.0)
  const toOpacity = (percent: number) => ((percent / 100) * 0.4).toFixed(2);

  // Softer color variants with higher lightness
  const q = compassQuadrantsFor(scheme);
  const tl = q.authoritarianLiberal.rgb;
  const tr = q.authoritarianConservative.rgb;
  const bl = q.libertarianLiberal.rgb;
  const br = q.libertarianConservative.rgb;
  const topLeft = `rgba(${tl[0]}, ${tl[1]}, ${tl[2]}, ${toOpacity(distribution.authoritarianSocialist)})`;
  const topRight = `rgba(${tr[0]}, ${tr[1]}, ${tr[2]}, ${toOpacity(distribution.authoritarianCapitalist)})`;
  const bottomLeft = `rgba(${bl[0]}, ${bl[1]}, ${bl[2]}, ${toOpacity(distribution.libertarianSocialist)})`;
  const bottomRight = `rgba(${br[0]}, ${br[1]}, ${br[2]}, ${toOpacity(distribution.libertarianCapitalist)})`;

  // Create a radial gradient for each corner and blend them
  // Gradient uses bright off-white wash slightly above card lightness
  // - Brighter than card (98%) and much brighter than original 90% muted
  // - Stays comfortably below 100% pure white for distinction
  return {
    background: `
      radial-gradient(circle at 0% 0%, ${topLeft} 0%, transparent 85%),
      radial-gradient(circle at 100% 0%, ${topRight} 0%, transparent 85%),
      radial-gradient(circle at 0% 100%, ${bottomLeft} 0%, transparent 85%),
      radial-gradient(circle at 100% 100%, ${bottomRight} 0%, transparent 85%),
      linear-gradient(135deg, hsl(from hsl(var(--card)) h s calc(l + 0.5) / alpha) 0%, hsl(var(--card)) 100%)
    `
  };
}

/**
 * Generate corner glow effects for a topic card using box-shadow
 * Glow emanates from corners outward based on political distribution
 */
export function getTopicCornerGlow(distribution: {
  authoritarianCapitalist: number;  // % of opinions (blue, auth-conservative) — top-right
  authoritarianSocialist: number;   // % of opinions (red, auth-liberal) — top-left
  libertarianCapitalist: number;    // % of opinions (yellow, lib-conservative) — bottom-right
  libertarianSocialist: number;     // % of opinions (green, lib-liberal) — bottom-left
}, scheme?: CompassColorScheme): React.CSSProperties {
  // Convert percentages (0-100) to glow intensity (0-1)
  const toIntensity = (percent: number) => Math.max(0, Math.min(1, percent / 100));
  
  // Base colors for each quadrant (RGB values)
  const q = compassQuadrantsFor(scheme);
  const [tlr, tlg, tlb] = q.authoritarianLiberal.rgb;
  const [trr, trg, trb] = q.authoritarianConservative.rgb;
  const [blr, blg, blb] = q.libertarianLiberal.rgb;
  const [brr, brg, brb] = q.libertarianConservative.rgb;
  const topLeftColor = { r: tlr, g: tlg, b: tlb };
  const topRightColor = { r: trr, g: trg, b: trb };
  const bottomLeftColor = { r: blr, g: blg, b: blb };
  const bottomRightColor = { r: brr, g: brg, b: brb };

  // Calculate glow values based on intensity
  const getGlowShadow = (intensity: number, color: { r: number; g: number; b: number }, offsetX: number, offsetY: number) => {
    if (intensity === 0) return '';
    const blur = 20 + (intensity * 30);    // 20-50px blur
    const spread = intensity * 15;        // 0-15px spread
    const opacity = 0.4 + (intensity * 0.4); // 40-80% opacity
    return `${offsetX}px ${offsetY}px ${blur}px ${spread}px rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
  };

  // Build box-shadow for each corner positioned outward
  const shadows: string[] = [];
  
  // Top-left — Authoritarian Liberal (red)
  const tlIntensity = toIntensity(distribution.authoritarianSocialist);
  if (tlIntensity > 0) {
    shadows.push(getGlowShadow(tlIntensity, topLeftColor, -20, -20));
  }

  // Top-right — Authoritarian Conservative (blue)
  const trIntensity = toIntensity(distribution.authoritarianCapitalist);
  if (trIntensity > 0) {
    shadows.push(getGlowShadow(trIntensity, topRightColor, 20, -20));
  }

  // Bottom-left — Libertarian Liberal (green)
  const blIntensity = toIntensity(distribution.libertarianSocialist);
  if (blIntensity > 0) {
    shadows.push(getGlowShadow(blIntensity, bottomLeftColor, -20, 20));
  }

  // Bottom-right — Libertarian Conservative (yellow)
  const brIntensity = toIntensity(distribution.libertarianCapitalist);
  if (brIntensity > 0) {
    shadows.push(getGlowShadow(brIntensity, bottomRightColor, 20, 20));
  }

  return {
    boxShadow: shadows.length > 0 ? shadows.join(', ') : 'none',
  };
}
