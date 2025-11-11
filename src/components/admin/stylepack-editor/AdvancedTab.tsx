import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface AdvancedTabProps {
  loraRef: string;
  shapeTemplate: string;
  allowedAccents: string;
  bannedTerms: string;
  paletteRange: string;
  onLoraRefChange: (value: string) => void;
  onShapeTemplateChange: (value: string) => void;
  onAllowedAccentsChange: (value: string) => void;
  onBannedTermsChange: (value: string) => void;
  onPaletteRangeChange: (value: string) => void;
  isUnpredictable: boolean;
}

export const AdvancedTab = ({
  loraRef,
  shapeTemplate,
  allowedAccents,
  bannedTerms,
  paletteRange,
  onLoraRefChange,
  onShapeTemplateChange,
  onAllowedAccentsChange,
  onBannedTermsChange,
  onPaletteRangeChange,
  isUnpredictable,
}: AdvancedTabProps) => {
  return (
    <div className="space-y-6 py-4">
      {isUnpredictable && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive font-medium">
            Unpredictable Configuration
          </span>
          <Badge variant="destructive" className="ml-auto">
            Out of Safe Range
          </Badge>
        </div>
      )}

      <div>
        <Label htmlFor="lora_ref" className="text-sm font-medium">
          LoRA Reference
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Format: model_name:weight (e.g., cake_design_v2:0.75). Safe range: 0.5-1.0
        </p>
        <Textarea
          id="lora_ref"
          value={loraRef}
          onChange={(e) => onLoraRefChange(e.target.value)}
          placeholder="cake_design_v2:0.75"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="shape_template" className="text-sm font-medium">
          Shape Template
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Comma-separated list of allowed cake shapes
        </p>
        <Textarea
          id="shape_template"
          value={shapeTemplate}
          onChange={(e) => onShapeTemplateChange(e.target.value)}
          placeholder="round, tiered, square, heart, custom"
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="allowed_accents" className="text-sm font-medium">
          Allowed Accents
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Comma-separated decoration elements
        </p>
        <Textarea
          id="allowed_accents"
          value={allowedAccents}
          onChange={(e) => onAllowedAccentsChange(e.target.value)}
          placeholder="gold, silver, rose gold, pearl white, champagne, blush pink"
          rows={4}
        />
      </div>

      <div>
        <Label htmlFor="banned_terms" className="text-sm font-medium">
          Banned Terms
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Comma-separated terms to exclude from generation
        </p>
        <Textarea
          id="banned_terms"
          value={bannedTerms}
          onChange={(e) => onBannedTermsChange(e.target.value)}
          placeholder="cartoon, anime, unrealistic, toy, plastic"
          rows={4}
        />
      </div>

      <div>
        <Label htmlFor="palette_range" className="text-sm font-medium">
          Palette Range (JSON)
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Define color palette as JSON: primary, accent, neutral arrays
        </p>
        <Textarea
          id="palette_range"
          value={paletteRange}
          onChange={(e) => onPaletteRangeChange(e.target.value)}
          placeholder='{"primary": ["#FFFFFF", "#FFF5F5"], "accent": ["#FFD700", "#C0C0C0"], "neutral": ["#F5F5DC"]}'
          rows={8}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
};
