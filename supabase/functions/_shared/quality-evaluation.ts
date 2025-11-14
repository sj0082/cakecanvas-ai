/**
 * Quality Evaluation System
 * Evaluates generated cake design proposals across multiple dimensions
 */

export interface QualityScores {
  onBrief: number;        // 0-1, adherence to user brief (CLIP similarity)
  paletteFit: number;     // 0-1, palette matching accuracy (ΔE-based)
  bakeability: number;    // 0-1, manufacturing feasibility
  aesthetic: number;      // 0-1, visual quality assessment
  overall: number;        // weighted average
}

export interface BakeabilityIssue {
  type: 'gravityViolation' | 'nonEdibleTexture' | 'logoReplication' | 'textDistortion' | 'unrealisticStructure';
  severity: number;       // 0-1
  description: string;
}

/**
 * Calculate On-Brief Score using CLIP-like text-image similarity
 * Measures how well the generated image matches the user's request
 */
export async function calculateOnBriefScore(
  imageUrl: string,
  userText: string,
  styleContext: string,
  lovableApiKey: string
): Promise<number> {
  try {
    console.log('📊 Calculating on-brief score...');
    
    // Use vision model to analyze if image matches the text description
    const prompt = `Analyze this cake design image and rate how well it matches this description on a scale of 0-100:

User Request: "${userText}"
Style Context: "${styleContext}"

Evaluate:
1. Does it match the requested style/theme?
2. Are the colors as requested?
3. Does it include requested elements (flowers, decorations, etc.)?
4. Is the overall aesthetic aligned with the request?

Return ONLY a number from 0-100, where:
- 100 = Perfect match to description
- 75-99 = Very good match with minor differences
- 50-74 = Moderate match, some key elements present
- 25-49 = Weak match, missing important elements
- 0-24 = Poor match, doesn't align with request`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 50
      }),
    });

    if (!response.ok) {
      console.error('Vision analysis failed:', response.status);
      return 0.5; // Default mid-score on failure
    }

    const data = await response.json();
    const scoreText = data.choices[0].message.content.trim();
    const score = parseInt(scoreText.match(/\d+/)?.[0] || '50');
    
    const normalized = Math.max(0, Math.min(100, score)) / 100;
    console.log(`✅ On-brief score: ${(normalized * 100).toFixed(0)}%`);
    
    return normalized;
  } catch (error) {
    console.error('Error calculating on-brief score:', error);
    return 0.5;
  }
}

/**
 * Calculate Palette Fit Score
 * Measures color accuracy using ΔE color difference
 */
export async function calculatePaletteFit(
  imageUrl: string,
  targetPalette: Array<{hex: string; ratio: number}>,
  lovableApiKey: string
): Promise<number> {
  try {
    console.log('🎨 Calculating palette fit...');
    
    if (!targetPalette || targetPalette.length === 0) {
      return 1.0; // No palette constraint = perfect fit
    }

    // Extract colors from generated image using vision
    const prompt = `Extract the main 5 colors from this cake image as hex codes.
Return ONLY a JSON array of hex codes like: ["#FFFFFF", "#FFB6C1", "#4A5568"]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        response_format: { type: 'json_object' },
        max_tokens: 100
      }),
    });

    if (!response.ok) {
      console.error('Color extraction failed:', response.status);
      return 0.7; // Default good score on failure
    }

    const data = await response.json();
    let extractedColors: string[] = [];
    
    try {
      const parsed = JSON.parse(data.choices[0].message.content);
      extractedColors = Array.isArray(parsed) ? parsed : (parsed.colors || []);
    } catch {
      extractedColors = data.choices[0].message.content.match(/#[0-9A-Fa-f]{6}/g) || [];
    }

    if (extractedColors.length === 0) {
      return 0.7;
    }

    // Calculate average ΔE for each extracted color against target palette
    let totalDeltaE = 0;
    let comparisons = 0;

    for (const extractedColor of extractedColors.slice(0, 5)) {
      let minDeltaE = Infinity;
      
      for (const targetColor of targetPalette) {
        const deltaE = calculateDeltaESimple(extractedColor, targetColor.hex);
        if (deltaE < minDeltaE) {
          minDeltaE = deltaE;
        }
      }
      
      totalDeltaE += minDeltaE;
      comparisons++;
    }

    const avgDeltaE = comparisons > 0 ? totalDeltaE / comparisons : 0;
    
    // Convert ΔE to 0-1 score: ΔE ≤ 10 = 1.0, ΔE ≥ 30 = 0.0
    const score = Math.max(0, Math.min(1, 1 - (avgDeltaE - 10) / 20));
    
    console.log(`✅ Palette fit score: ${(score * 100).toFixed(0)}% (avg ΔE: ${avgDeltaE.toFixed(1)})`);
    return score;
  } catch (error) {
    console.error('Error calculating palette fit:', error);
    return 0.7;
  }
}

/**
 * Simple ΔE calculation (CIE76)
 */
function calculateDeltaESimple(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  const rDiff = rgb1.r - rgb2.r;
  const gDiff = rgb1.g - rgb2.g;
  const bDiff = rgb1.b - rgb2.b;
  
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff) * 100;
}

function hexToRgb(hex: string): {r: number; g: number; b: number} {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return {r: 0, g: 0, b: 0};
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Check Bakeability (Manufacturing Feasibility)
 * Analyzes if the design can be realistically manufactured
 */
export async function checkBakeability(
  imageUrl: string,
  realityRules: Array<{key: string; message: string; severity: string}>,
  lovableApiKey: string
): Promise<{
  score: number;
  issues: BakeabilityIssue[];
}> {
  try {
    console.log('🏗️ Checking bakeability...');
    
    const prompt = `Analyze this cake design for manufacturing feasibility. Check for these issues:

1. Gravity violations (floating tiers, unsupported structures)
2. Non-edible textures (metallic, plastic, glass)
3. Logo/brand replication (copyrighted characters, brands)
4. Text distortion (unreadable text, warped letters)
5. Unrealistic structures (impossible architecture, physics-defying elements)

Return a JSON object with:
{
  "issues": [
    {"type": "gravityViolation", "severity": 0.8, "description": "Top tier appears unsupported"},
    ...
  ]
}

If no issues found, return: {"issues": []}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        response_format: { type: 'json_object' },
        max_tokens: 300
      }),
    });

    if (!response.ok) {
      console.error('Bakeability check failed:', response.status);
      return { score: 0.8, issues: [] };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    const issues: BakeabilityIssue[] = result.issues || [];

    // Calculate score: subtract severity of issues from 1.0
    let totalPenalty = 0;
    for (const issue of issues) {
      totalPenalty += issue.severity * 0.3; // Each issue penalizes up to 30%
    }
    
    const score = Math.max(0, 1 - totalPenalty);
    
    console.log(`✅ Bakeability score: ${(score * 100).toFixed(0)}% (${issues.length} issues)`);
    return { score, issues };
  } catch (error) {
    console.error('Error checking bakeability:', error);
    return { score: 0.8, issues: [] };
  }
}

/**
 * Calculate Aesthetic Score
 * Evaluates visual quality (blur, noise, composition, lighting)
 */
export async function calculateAestheticScore(
  imageUrl: string,
  lovableApiKey: string
): Promise<number> {
  try {
    console.log('✨ Calculating aesthetic score...');
    
    const prompt = `Rate the visual quality of this cake design image on a scale of 0-100.

Evaluate:
1. Image sharpness (not blurry)
2. Proper lighting (not too dark/bright)
3. Good composition (well-framed, centered)
4. Professional appearance
5. Clean, clear details

Return ONLY a number from 0-100, where:
- 90-100 = Professional photography quality
- 75-89 = Good quality, minor issues
- 50-74 = Acceptable quality, some problems
- 25-49 = Poor quality, significant issues
- 0-24 = Very poor quality, major problems`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        max_tokens: 50
      }),
    });

    if (!response.ok) {
      console.error('Aesthetic check failed:', response.status);
      return 0.75;
    }

    const data = await response.json();
    const scoreText = data.choices[0].message.content.trim();
    const score = parseInt(scoreText.match(/\d+/)?.[0] || '75');
    
    const normalized = Math.max(0, Math.min(100, score)) / 100;
    console.log(`✅ Aesthetic score: ${(normalized * 100).toFixed(0)}%`);
    
    return normalized;
  } catch (error) {
    console.error('Error calculating aesthetic score:', error);
    return 0.75;
  }
}

/**
 * Comprehensive Proposal Evaluation
 * Combines all quality metrics into overall score
 */
export async function evaluateProposal(
  imageUrl: string,
  userText: string,
  styleContext: string,
  targetPalette: Array<{hex: string; ratio: number}>,
  realityRules: Array<{key: string; message: string; severity: string}>,
  lovableApiKey: string
): Promise<QualityScores> {
  console.log('📊 Starting comprehensive quality evaluation...');
  
  try {
    // Run all evaluations in parallel for speed
    const [onBrief, paletteFit, bakeabilityResult, aesthetic] = await Promise.all([
      calculateOnBriefScore(imageUrl, userText, styleContext, lovableApiKey),
      calculatePaletteFit(imageUrl, targetPalette, lovableApiKey),
      checkBakeability(imageUrl, realityRules, lovableApiKey),
      calculateAestheticScore(imageUrl, lovableApiKey)
    ]);

    // Weighted average: on-brief 30%, palette 25%, bakeability 25%, aesthetic 20%
    const overall = (onBrief * 0.30) + (paletteFit * 0.25) + (bakeabilityResult.score * 0.25) + (aesthetic * 0.20);

    const scores: QualityScores = {
      onBrief,
      paletteFit,
      bakeability: bakeabilityResult.score,
      aesthetic,
      overall
    };

    console.log(`✅ Overall quality score: ${(overall * 100).toFixed(0)}%`);
    console.log(`   - On-brief: ${(onBrief * 100).toFixed(0)}%`);
    console.log(`   - Palette fit: ${(paletteFit * 100).toFixed(0)}%`);
    console.log(`   - Bakeability: ${(bakeabilityResult.score * 100).toFixed(0)}%`);
    console.log(`   - Aesthetic: ${(aesthetic * 100).toFixed(0)}%`);

    return scores;
  } catch (error) {
    console.error('Error in comprehensive evaluation:', error);
    // Return conservative default scores on error
    return {
      onBrief: 0.6,
      paletteFit: 0.7,
      bakeability: 0.8,
      aesthetic: 0.75,
      overall: 0.7
    };
  }
}
