// Color palette generation utilities for creating harmonious themes

export interface HSL {
  h: number; // Hue: 0-360
  s: number; // Saturation: 0-100
  l: number; // Lightness: 0-100
}

export interface ThemeColors {
  background: HSL;
  foreground: HSL;
  card: HSL;
  cardForeground: HSL;
  popover: HSL;
  popoverForeground: HSL;
  primary: HSL;
  primaryForeground: HSL;
  secondary: HSL;
  secondaryForeground: HSL;
  muted: HSL;
  mutedForeground: HSL;
  accent: HSL;
  accentForeground: HSL;
  destructive: HSL;
  destructiveForeground: HSL;
  border: HSL;
  input: HSL;
  ring: HSL;
}

/**
 * Parse HSL string to HSL object
 */
export function parseHSL(hslString: string): HSL {
  const match = hslString.match(/(\d+)\s+(\d+)%?\s+(\d+)%?/);
  if (!match) {
    throw new Error(`Invalid HSL string: ${hslString}`);
  }
  return {
    h: parseInt(match[1]),
    s: parseInt(match[2]),
    l: parseInt(match[3]),
  };
}

/**
 * Format HSL object to CSS-compatible string (H S% L%)
 */
export function formatHSL(hsl: HSL): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHSL(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert hex color to HSL
 */
export function hexToHSL(hex: string): HSL {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return rgbToHSL(r, g, b);
}

/**
 * Determine if a color is light or dark based on luminance
 */
export function isLightColor(hsl: HSL): boolean {
  return hsl.l > 50;
}

/**
 * Determine theme type based on background lightness
 */
export function getThemeType(background: HSL): 'light' | 'medium' | 'dark' {
  if (background.l >= 70) return 'light';
  if (background.l >= 35) return 'medium';
  return 'dark';
}

/**
 * Calculate contrast ratio between two colors (approximate using lightness)
 */
export function getContrastRatio(color1: HSL, color2: HSL): number {
  const l1 = color1.l / 100;
  const l2 = color2.l / 100;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjust color to ensure minimum contrast ratio
 */
export function ensureContrast(foreground: HSL, background: HSL, minRatio: number = 4.5): HSL {
  const result = { ...foreground };
  const isLight = isLightColor(background);
  
  // If background is light, make foreground darker
  // If background is dark, make foreground lighter
  let ratio = getContrastRatio(result, background);
  let step = 0;
  
  while (ratio < minRatio && step < 100) {
    if (isLight) {
      result.l = Math.max(0, result.l - 2);
    } else {
      result.l = Math.min(100, result.l + 2);
    }
    ratio = getContrastRatio(result, background);
    step++;
  }
  
  return result;
}

/**
 * Generate a harmonious color palette from a base background color
 * This creates a complete theme with proper contrast and visual harmony
 */
export function generatePalette(backgroundColor: HSL): ThemeColors {
  const themeType = getThemeType(backgroundColor);
  const isLight = themeType === 'light';
  const isMedium = themeType === 'medium';
  
  // Background and its slight elevation for cards
  const background = backgroundColor;
  const card: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 2),
    l: isLight ? Math.min(100, background.l + 2) : Math.max(0, background.l + 4),
  };
  
  // Popover (similar to card but slightly more elevated)
  const popover: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 1),
    l: isLight ? Math.min(100, background.l + 3) : Math.max(0, background.l + 6),
  };
  
  // Foreground text colors with proper contrast
  const foreground: HSL = isLight
    ? { h: background.h, s: Math.min(15, background.s), l: 20 }
    : { h: background.h, s: Math.min(8, background.s), l: 90 };
  
  const cardForeground = ensureContrast({ ...foreground }, card);
  const popoverForeground = ensureContrast({ ...foreground }, popover);
  
  // Primary accent - use complementary or analogous hue
  const primaryHue = (background.h + 180) % 360; // Complementary for contrast
  const primary: HSL = {
    h: primaryHue,
    s: isLight ? 70 : 65,
    l: isLight ? 45 : 55,
  };
  
  const primaryForeground: HSL = {
    h: primaryHue,
    s: 5,
    l: isLight ? 98 : 10,
  };
  
  // Secondary accent - analogous to primary
  const secondaryHue = (primaryHue + 30) % 360;
  const secondary: HSL = {
    h: secondaryHue,
    s: isLight ? 25 : 20,
    l: isLight ? 92 : 28,
  };
  
  const secondaryForeground = ensureContrast(
    { h: secondaryHue, s: 10, l: isLight ? 20 : 90 },
    secondary
  );
  
  // Muted - subdued version of background
  const muted: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 5),
    l: isLight ? Math.max(0, background.l - 8) : Math.min(100, background.l + 12),
  };
  
  const mutedForeground = ensureContrast(
    { h: background.h, s: 8, l: isLight ? 50 : 70 },
    muted
  );
  
  // Accent - vibrant, attention-grabbing
  const accentHue = (background.h + 120) % 360; // Triadic harmony
  const accent: HSL = {
    h: accentHue,
    s: isLight ? 30 : 25,
    l: isLight ? 90 : 30,
  };
  
  const accentForeground = ensureContrast(
    { h: accentHue, s: 10, l: isLight ? 20 : 90 },
    accent
  );
  
  // Destructive - red-based for errors/warnings
  const destructive: HSL = {
    h: 0, // Red
    s: isLight ? 75 : 70,
    l: isLight ? 50 : 55,
  };
  
  const destructiveForeground: HSL = {
    h: 0,
    s: 5,
    l: isLight ? 98 : 10,
  };
  
  // Borders and inputs - subtle separation
  const border: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 3),
    l: isLight ? Math.max(0, background.l - 15) : Math.min(100, background.l + 15),
  };
  
  const input: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 3),
    l: isLight ? Math.max(0, background.l - 12) : Math.min(100, background.l + 12),
  };
  
  // Ring - for focus states
  const ring: HSL = {
    h: primary.h,
    s: primary.s,
    l: primary.l,
  };
  
  return {
    background,
    foreground,
    card,
    cardForeground,
    popover,
    popoverForeground,
    primary,
    primaryForeground,
    secondary,
    secondaryForeground,
    muted,
    mutedForeground,
    accent,
    accentForeground,
    destructive,
    destructiveForeground,
    border,
    input,
    ring,
  };
}

/**
 * Generate 5 palette variations from a base background color using different color harmonies
 */
export function generatePaletteVariations(backgroundColor: HSL): ThemeColors[] {
  const variations: ThemeColors[] = [];
  const themeType = getThemeType(backgroundColor);
  const isLight = themeType === 'light';
  
  // Variation 1: Complementary (default)
  variations.push(generatePalette(backgroundColor));
  
  // Variation 2: Analogous (30° apart)
  variations.push(generatePaletteWithPrimaryHue(backgroundColor, (backgroundColor.h + 30) % 360));
  
  // Variation 3: Triadic (120° apart)
  variations.push(generatePaletteWithPrimaryHue(backgroundColor, (backgroundColor.h + 120) % 360));
  
  // Variation 4: Split-Complementary (150° apart)
  variations.push(generatePaletteWithPrimaryHue(backgroundColor, (backgroundColor.h + 150) % 360));
  
  // Variation 5: Double Complementary (60° from complementary)
  variations.push(generatePaletteWithPrimaryHue(backgroundColor, (backgroundColor.h + 240) % 360));
  
  return variations;
}

/**
 * Generate palette with custom primary hue for variations
 */
function generatePaletteWithPrimaryHue(backgroundColor: HSL, primaryHue: number): ThemeColors {
  const themeType = getThemeType(backgroundColor);
  const isLight = themeType === 'light';
  
  const background = backgroundColor;
  const card: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 2),
    l: isLight ? Math.min(100, background.l + 2) : Math.max(0, background.l + 4),
  };
  
  const popover: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 1),
    l: isLight ? Math.min(100, background.l + 3) : Math.max(0, background.l + 6),
  };
  
  const foreground: HSL = isLight
    ? { h: background.h, s: Math.min(15, background.s), l: 20 }
    : { h: background.h, s: Math.min(8, background.s), l: 90 };
  
  const cardForeground = ensureContrast({ ...foreground }, card);
  const popoverForeground = ensureContrast({ ...foreground }, popover);
  
  // Use custom primary hue
  const primary: HSL = {
    h: primaryHue,
    s: isLight ? 70 : 65,
    l: isLight ? 45 : 55,
  };
  
  const primaryForeground: HSL = {
    h: primaryHue,
    s: 5,
    l: isLight ? 98 : 10,
  };
  
  const secondaryHue = (primaryHue + 30) % 360;
  const secondary: HSL = {
    h: secondaryHue,
    s: isLight ? 25 : 20,
    l: isLight ? 92 : 28,
  };
  
  const secondaryForeground = ensureContrast(
    { h: secondaryHue, s: 10, l: isLight ? 20 : 90 },
    secondary
  );
  
  const muted: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 5),
    l: isLight ? Math.max(0, background.l - 8) : Math.min(100, background.l + 12),
  };
  
  const mutedForeground = ensureContrast(
    { h: background.h, s: 8, l: isLight ? 50 : 70 },
    muted
  );
  
  const accentHue = (primaryHue + 90) % 360;
  const accent: HSL = {
    h: accentHue,
    s: isLight ? 30 : 25,
    l: isLight ? 90 : 30,
  };
  
  const accentForeground = ensureContrast(
    { h: accentHue, s: 10, l: isLight ? 20 : 90 },
    accent
  );
  
  const destructive: HSL = {
    h: 0,
    s: isLight ? 75 : 70,
    l: isLight ? 50 : 55,
  };
  
  const destructiveForeground: HSL = {
    h: 0,
    s: 5,
    l: isLight ? 98 : 10,
  };
  
  const border: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 3),
    l: isLight ? Math.max(0, background.l - 15) : Math.min(100, background.l + 15),
  };
  
  const input: HSL = {
    h: background.h,
    s: Math.max(0, background.s - 3),
    l: isLight ? Math.max(0, background.l - 12) : Math.min(100, background.l + 12),
  };
  
  const ring: HSL = {
    h: primary.h,
    s: primary.s,
    l: primary.l,
  };
  
  return {
    background,
    foreground,
    card,
    cardForeground,
    popover,
    popoverForeground,
    primary,
    primaryForeground,
    secondary,
    secondaryForeground,
    muted,
    mutedForeground,
    accent,
    accentForeground,
    destructive,
    destructiveForeground,
    border,
    input,
    ring,
  };
}

/**
 * Validate that a theme has acceptable contrast ratios
 */
export function validateTheme(theme: ThemeColors): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check main text contrast
  const fgBgContrast = getContrastRatio(theme.foreground, theme.background);
  if (fgBgContrast < 4.5) {
    issues.push('Main text contrast is too low');
  }
  
  // Check card text contrast
  const cardContrast = getContrastRatio(theme.cardForeground, theme.card);
  if (cardContrast < 4.5) {
    issues.push('Card text contrast is too low');
  }
  
  // Check primary button contrast
  const primaryContrast = getContrastRatio(theme.primaryForeground, theme.primary);
  if (primaryContrast < 4.5) {
    issues.push('Primary button text contrast is too low');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
