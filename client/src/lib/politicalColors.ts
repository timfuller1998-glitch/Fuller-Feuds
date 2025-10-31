/**
 * Political gradient utilities for Opinion Feud
 * Generates colors and gradients based on 2D political compass scores
 */

/**
 * Convert HSL values to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Get the 2D political compass color for a given position
 * @param economicScore -100 (socialist) to +100 (capitalist)
 * @param authoritarianScore -100 (libertarian) to +100 (authoritarian)
 * @returns hex color string
 */
export function get2DPoliticalCompassColor(economicScore: number, authoritarianScore: number): string {
  // Normalize scores to -1 to 1 range for easier calculation
  const x = economicScore / 100;  // -1 (socialist) to +1 (capitalist)
  const y = authoritarianScore / 100;  // -1 (libertarian) to +1 (authoritarian)
  
  // Calculate distance from center (0,0) - used for intensity
  const distanceFromCenter = Math.sqrt(x * x + y * y);
  const intensity = Math.min(distanceFromCenter, 1); // 0 to 1
  
  // Base colors for each quadrant (Hue, Saturation, Lightness)
  // Red (authoritarian capitalist): H=0, x > 0, y > 0
  // Blue (authoritarian socialist): H=220, x < 0, y > 0
  // Yellow (libertarian capitalist): H=50, x > 0, y < 0
  // Green (libertarian socialist): H=140, x < 0, y < 0
  
  let hue: number;
  let saturation: number;
  let lightness: number;
  
  // Determine quadrant and base color - SOFT VIBRANT COLORS for text legibility
  // Tie-breaking: 0 on either axis is treated as the positive side (capitalist/authoritarian)
  // This matches the backend quadrant classification logic
  if (x >= 0 && y >= 0) {
    // Authoritarian Capitalist (Red) - top right
    hue = 0;
    saturation = 35 + (intensity * 15); // 35-50% - softer saturation
    lightness = 75; // Higher lightness for softer colors
  } else if (x < 0 && y >= 0) {
    // Authoritarian Socialist (Blue) - top left
    hue = 220;
    saturation = 35 + (intensity * 15); // 35-50% - softer saturation
    lightness = 75; // Higher lightness for softer colors
  } else if (x >= 0 && y < 0) {
    // Libertarian Capitalist (Yellow) - bottom right
    hue = 50;
    saturation = 35 + (intensity * 15); // 35-50% - softer saturation
    lightness = 75; // Higher lightness for softer colors
  } else {
    // Libertarian Socialist (Green) - bottom left
    hue = 140;
    saturation = 35 + (intensity * 15); // 35-50% - softer saturation
    lightness = 75; // Higher lightness for softer colors
  }
  
  // Blend colors more - only a little white in the center
  if (distanceFromCenter < 0.15) {
    // Very center - slight desaturation
    saturation = saturation * 0.5;
    lightness = 85; // Very light at center
  } else if (distanceFromCenter < 0.3) {
    // Near center - moderate blending
    saturation = saturation * 0.7;
    lightness = 80; // Light near center
  } else {
    // Further from center - still soft but with more color
    lightness = 75 - (intensity * 5); // Subtle darkening with intensity
  }
  
  // Fade to darker (not black) at extremes (±85 on both axes)
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX >= 0.85 || absY >= 0.85) {
    // Calculate how far into the extreme zone (0.85 to 1.0)
    const maxAbsolute = Math.max(absX, absY);
    const extremeFactor = (maxAbsolute - 0.85) / 0.15; // 0 at 0.85, 1 at 1.0
    
    // Fade to darker by reducing lightness moderately (not as dramatic)
    lightness = lightness * (1 - extremeFactor * 0.4); // Reduce lightness up to 40%
    saturation = saturation * (1 + extremeFactor * 0.3); // Slightly increase saturation at extremes
  }
  
  return hslToHex(hue, saturation, lightness);
}

/**
 * Generate a subtle gradient background style for an opinion card
 * based on the opinion's political scores
 */
export function getOpinionGradientStyle(
  economicScore: number | null | undefined,
  authoritarianScore: number | null | undefined
): React.CSSProperties {
  // If scores are not available, return neutral gradient
  if (economicScore === null || economicScore === undefined || 
      authoritarianScore === null || authoritarianScore === undefined) {
    return {
      background: 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted) / 0.5) 100%)'
    };
  }

  const baseColor = get2DPoliticalCompassColor(economicScore, authoritarianScore);
  
  // Create a very subtle gradient from the political color to transparent
  return {
    background: `linear-gradient(135deg, ${baseColor}25 0%, ${baseColor}10 100%)`
  };
}

/**
 * Generate a 4-corner weighted gradient for a topic card
 * based on the distribution of opinions across political quadrants
 */
export function getTopicCornerGradient(distribution: {
  authoritarianCapitalist: number;  // % of opinions (Red) - top-right corner
  authoritarianSocialist: number;   // % of opinions (Blue) - top-left corner
  libertarianCapitalist: number;    // % of opinions (Yellow) - bottom-right corner
  libertarianSocialist: number;     // % of opinions (Green) - bottom-left corner
}): React.CSSProperties {
  // Quadrant colors - softer, more pastel versions for text legibility
  // Convert percentages (0-100) to reduced opacity (max 0.4 instead of 1.0)
  const toOpacity = (percent: number) => ((percent / 100) * 0.4).toFixed(2);

  // Softer color variants with higher lightness
  const topLeft = `rgba(100, 150, 255, ${toOpacity(distribution.authoritarianSocialist)})`;      // Soft Blue
  const topRight = `rgba(255, 120, 130, ${toOpacity(distribution.authoritarianCapitalist)})`;     // Soft Red
  const bottomLeft = `rgba(100, 200, 150, ${toOpacity(distribution.libertarianSocialist)})`;      // Soft Green
  const bottomRight = `rgba(255, 220, 100, ${toOpacity(distribution.libertarianCapitalist)})`;    // Soft Yellow

  // Create a radial gradient for each corner and blend them
  return {
    background: `
      radial-gradient(circle at 0% 0%, ${topLeft} 0%, transparent 70%),
      radial-gradient(circle at 100% 0%, ${topRight} 0%, transparent 70%),
      radial-gradient(circle at 0% 100%, ${bottomLeft} 0%, transparent 70%),
      radial-gradient(circle at 100% 100%, ${bottomRight} 0%, transparent 70%),
      linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted) / 0.8) 100%)
    `
  };
}
