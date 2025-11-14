/**
 * Color utilities for palette validation and ΔE calculations
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Convert RGB to XYZ color space
 */
function rgbToXyz(rgb: RGB): { x: number; y: number; z: number } {
  let { r, g, b } = rgb;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Observer = 2°, Illuminant = D65
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  return { x: x * 100, y: y * 100, z: z * 100 };
}

/**
 * Convert XYZ to Lab color space
 */
function xyzToLab(xyz: { x: number; y: number; z: number }): Lab {
  // D65 reference white
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  let x = xyz.x / refX;
  let y = xyz.y / refY;
  let z = xyz.z / refZ;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

  return {
    L: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

/**
 * Convert hex color to Lab color space
 */
export function hexToLab(hex: string): Lab {
  const rgb = hexToRgb(hex);
  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

/**
 * Calculate ΔE (color difference) using CIE76 formula
 * ΔE < 1: Not perceptible
 * ΔE 1-2: Perceptible through close observation
 * ΔE 2-10: Perceptible at a glance
 * ΔE 11-49: Colors are more similar than opposite
 * ΔE > 50: Colors are exact opposite
 */
export function calculateDeltaE(color1: string, color2: string): number {
  const lab1 = hexToLab(color1);
  const lab2 = hexToLab(color2);

  const deltaL = lab1.L - lab2.L;
  const deltaA = lab1.a - lab2.a;
  const deltaB = lab1.b - lab2.b;

  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

/**
 * Validate palette lock constraint (ΔE ≤ 10 for all colors)
 */
export function validatePaletteLock(
  requestedColors: string[],
  lockedPalette: Array<{ hex: string; ratio: number }>
): {
  isValid: boolean;
  violations: Array<{
    color: string;
    closestMatch: string;
    deltaE: number;
  }>;
} {
  const violations: Array<{ color: string; closestMatch: string; deltaE: number }> = [];

  for (const requestedColor of requestedColors) {
    let minDeltaE = Infinity;
    let closestMatch = '';

    // Find closest color in locked palette
    for (const paletteColor of lockedPalette) {
      const deltaE = calculateDeltaE(requestedColor, paletteColor.hex);
      if (deltaE < minDeltaE) {
        minDeltaE = deltaE;
        closestMatch = paletteColor.hex;
      }
    }

    // Check if ΔE exceeds threshold
    if (minDeltaE > 10) {
      violations.push({
        color: requestedColor,
        closestMatch,
        deltaE: minDeltaE,
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Extract colors from text (simple regex-based extraction)
 */
export function extractColorsFromText(text: string): string[] {
  const colorMap: Record<string, string> = {
    'red': '#FF0000',
    'blue': '#0000FF',
    'green': '#00FF00',
    'yellow': '#FFFF00',
    'orange': '#FFA500',
    'purple': '#800080',
    'pink': '#FFC0CB',
    'black': '#000000',
    'white': '#FFFFFF',
    'brown': '#A52A2A',
    'gold': '#FFD700',
    'silver': '#C0C0C0',
    'navy': '#000080',
    'teal': '#008080',
    'maroon': '#800000',
    'olive': '#808000',
    'lime': '#00FF00',
    'aqua': '#00FFFF',
    'fuchsia': '#FF00FF',
  };

  const colors: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [colorName, hexValue] of Object.entries(colorMap)) {
    if (lowerText.includes(colorName)) {
      colors.push(hexValue);
    }
  }

  return colors;
}
