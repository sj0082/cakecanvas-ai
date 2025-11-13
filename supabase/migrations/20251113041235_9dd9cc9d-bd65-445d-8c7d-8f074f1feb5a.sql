-- Add style control parameters to stylepacks table
ALTER TABLE stylepacks 
  ADD COLUMN IF NOT EXISTS style_strength DECIMAL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS sharpness DECIMAL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS realism DECIMAL DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS complexity DECIMAL DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS palette_lock DECIMAL DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS uniformity DECIMAL DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS performance_profile TEXT DEFAULT 'standard';

-- Add constraints for parameter values (0.0-1.0 range)
ALTER TABLE stylepacks 
  ADD CONSTRAINT style_strength_range CHECK (style_strength >= 0 AND style_strength <= 1),
  ADD CONSTRAINT sharpness_range CHECK (sharpness >= 0 AND sharpness <= 1),
  ADD CONSTRAINT realism_range CHECK (realism >= 0 AND realism <= 1),
  ADD CONSTRAINT complexity_range CHECK (complexity >= 0 AND complexity <= 1),
  ADD CONSTRAINT palette_lock_range CHECK (palette_lock >= 0 AND palette_lock <= 1),
  ADD CONSTRAINT uniformity_range CHECK (uniformity >= 0 AND uniformity <= 1),
  ADD CONSTRAINT performance_profile_values CHECK (performance_profile IN ('draft', 'standard', 'quality'));

COMMENT ON COLUMN stylepacks.style_strength IS 'Style adherence strength (0-1), higher = closer to reference';
COMMENT ON COLUMN stylepacks.sharpness IS 'Image detail sharpness (0-1)';
COMMENT ON COLUMN stylepacks.realism IS 'Photorealism level (0-1)';
COMMENT ON COLUMN stylepacks.complexity IS 'Decoration complexity (0-1), higher = more intricate';
COMMENT ON COLUMN stylepacks.palette_lock IS 'Color palette strictness (0-1)';
COMMENT ON COLUMN stylepacks.uniformity IS 'Consistency across variants (0-1)';
COMMENT ON COLUMN stylepacks.performance_profile IS 'Generation quality preset: draft/standard/quality';