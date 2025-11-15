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
 * Convert hex color to RGB (supports both 3 and 6 digit formats)
 */
export function hexToRgb(hex: string): RGB {
  // Remove # if present
  let cleanHex = hex.replace(/^#/, '');
  
  // Convert 3-digit to 6-digit
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);
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
 * Convert hex to OKLab color space for more perceptually uniform color difference
 * OKLab provides better perceptual uniformity than CIE Lab
 */
export function hexToOKLab(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex);
  
  // Convert RGB [0-1] to linear RGB
  const rLinear = rgb.r <= 0.04045 
    ? rgb.r / 12.92 
    : Math.pow((rgb.r + 0.055) / 1.055, 2.4);
  const gLinear = rgb.g <= 0.04045 
    ? rgb.g / 12.92 
    : Math.pow((rgb.g + 0.055) / 1.055, 2.4);
  const bLinear = rgb.b <= 0.04045 
    ? rgb.b / 12.92 
    : Math.pow((rgb.b + 0.055) / 1.055, 2.4);
  
  // Convert linear RGB to XYZ (D65 illuminant)
  const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375;
  const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750;
  const z = rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041;
  
  // Convert XYZ to OKLab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);
  
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  
  return [L * 100, a * 100, b * 100];
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
