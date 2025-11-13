-- Add trend keywords columns to stylepacks table
ALTER TABLE stylepacks 
  ADD COLUMN IF NOT EXISTS trend_keywords TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS trend_techniques TEXT[] DEFAULT NULL;

COMMENT ON COLUMN stylepacks.trend_keywords IS 'Category-specific trending keywords for 2025 (e.g., "Modern minimalist", "Textured buttercream")';
COMMENT ON COLUMN stylepacks.trend_techniques IS 'Trending decoration techniques for this category (e.g., "Fresh flower arrangements", "Geometric patterns")';

-- Update existing stylepacks with sample trend data
UPDATE stylepacks 
SET 
  trend_keywords = ARRAY[
    'Timeless elegance',
    'Modern romantic aesthetics',
    'Instagram-worthy designs',
    'Contemporary color palettes'
  ],
  trend_techniques = ARRAY[
    'Textured buttercream',
    'Fresh flower arrangements',
    'Geometric patterns',
    'Ombré effects'
  ]
WHERE trend_keywords IS NULL;