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
  // Green (libertarian capitalist): H=140, x > 0, y < 0
  // Yellow (libertarian socialist): H=50, x < 0, y < 0
  
  let hue: number;
  let saturation: number;
  let lightness: number;
  
  // Determine quadrant and base color
  // Tie-breaking: 0 on either axis is treated as the positive side (capitalist/authoritarian)
  // This matches the backend quadrant classification logic
  if (x >= 0 && y >= 0) {
    // Authoritarian Capitalist (Red) - top right
    hue = 0;
    saturation = 70 + (intensity * 25); // 70-95%
    lightness = 55;
  } else if (x < 0 && y >= 0) {
    // Authoritarian Socialist (Blue) - top left
    hue = 220;
    saturation = 70 + (intensity * 25); // 70-95%
    lightness = 55;
  } else if (x >= 0 && y < 0) {
    // Libertarian Capitalist (Green) - bottom right
    hue = 140;
    saturation = 65 + (intensity * 30); // 65-95%
    lightness = 50;
  } else {
    // Libertarian Socialist (Yellow) - bottom left
    hue = 50;
    saturation = 70 + (intensity * 25); // 70-95%
    lightness = 55;
  }
  
  // Blend colors more - only a little white in the center
  if (distanceFromCenter < 0.15) {
    // Very center - slight desaturation
    saturation = saturation * 0.6;
    lightness = 65;
  } else if (distanceFromCenter < 0.3) {
    // Near center - moderate blending
    saturation = saturation * 0.8;
    lightness = 60;
  } else {
    // Further from center - stronger colors
    lightness = 55 - (intensity * 10);
  }
  
  // Fade to black at extremes (±85 on both axes)
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX >= 0.85 || absY >= 0.85) {
    // Calculate how far into the extreme zone (0.85 to 1.0)
    const maxAbsolute = Math.max(absX, absY);
    const extremeFactor = (maxAbsolute - 0.85) / 0.15; // 0 at 0.85, 1 at 1.0
    
    // Fade to black by reducing lightness dramatically
    lightness = lightness * (1 - extremeFactor * 0.7); // Reduce lightness up to 70%
    saturation = saturation * (1 - extremeFactor * 0.3); // Also reduce saturation a bit
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
  
  // Create a subtle gradient from the political color to transparent
  return {
    background: `linear-gradient(135deg, ${baseColor}15 0%, ${baseColor}05 100%)`
  };
}

/**
 * Generate a 4-corner weighted gradient for a topic card
 * based on the distribution of opinions across political quadrants
 */
export function getTopicCornerGradient(distribution: {
  authoritarianCapitalist: number;  // % of opinions (Red) - top-right corner
  authoritarianSocialist: number;   // % of opinions (Blue) - top-left corner
  libertarianCapitalist: number;    // % of opinions (Green) - bottom-right corner
  libertarianSocialist: number;     // % of opinions (Yellow) - bottom-left corner
}): React.CSSProperties {
  // Quadrant colors (same as political compass)
  // Convert percentages (0-100) to opacity (0-1)
  const toOpacity = (percent: number) => (percent / 100).toFixed(2);

  const topLeft = `rgba(13, 110, 253, ${toOpacity(distribution.authoritarianSocialist)})`;      // Blue
  const topRight = `rgba(220, 53, 69, ${toOpacity(distribution.authoritarianCapitalist)})`;     // Red
  const bottomLeft = `rgba(255, 193, 7, ${toOpacity(distribution.libertarianSocialist)})`;      // Yellow
  const bottomRight = `rgba(25, 135, 84, ${toOpacity(distribution.libertarianCapitalist)})`;    // Green

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
