import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Slider } from "@/components/ui/slider";

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
  // Parse LoRA ref into model name and weight
  const loraModel = loraRef.split(':')[0] || 'cake_design_v2';
  const loraWeight = parseFloat(loraRef.split(':')[1] || '0.75');

  const handleLoraModelChange = (model: string) => {
    onLoraRefChange(`${model}:${loraWeight}`);
  };

  const handleLoraWeightChange = (weight: number) => {
    onLoraRefChange(`${loraModel}:${weight.toFixed(2)}`);
  };

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

      <div className="space-y-4">
        <div>
          <Label htmlFor="lora_model" className="text-sm font-medium">
            LoRA Model Name
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Model identifier for style generation
          </p>
          <Input
            id="lora_model"
            value={loraModel}
            onChange={(e) => handleLoraModelChange(e.target.value)}
            placeholder="cake_design_v2"
          />
        </div>

        <div>
          <Label htmlFor="lora_weight" className="text-sm font-medium">
            Initial Weight: {loraWeight.toFixed(2)}
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            Safe range: 0.5-1.0. Higher values = stronger style influence
          </p>
          <Slider
            id="lora_weight"
            value={[loraWeight]}
            onValueChange={([value]) => handleLoraWeightChange(value)}
            min={0.1}
            max={1.5}
            step={0.05}
            className="mt-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.1</span>
            <span className="text-primary font-medium">Safe: 0.5-1.0</span>
            <span>1.5</span>
          </div>
        </div>
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
