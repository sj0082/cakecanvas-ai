import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface SimpleTabProps {
  styleStrength: number;
  sharpness: number;
  realism: number;
  complexity: number;
  paletteLock: number;
  uniformity: number;
  performanceProfile: "draft" | "standard" | "quality";
  onStyleStrengthChange: (value: number) => void;
  onSharpnessChange: (value: number) => void;
  onRealismChange: (value: number) => void;
  onComplexityChange: (value: number) => void;
  onPaletteLockChange: (value: number) => void;
  onUniformityChange: (value: number) => void;
  onPerformanceProfileChange: (value: "draft" | "standard" | "quality") => void;
}

export const SimpleTab = ({
  styleStrength,
  sharpness,
  realism,
  complexity,
  paletteLock,
  uniformity,
  performanceProfile,
  onStyleStrengthChange,
  onSharpnessChange,
  onRealismChange,
  onComplexityChange,
  onPaletteLockChange,
  onUniformityChange,
  onPerformanceProfileChange,
}: SimpleTabProps) => {
  const SliderWithTooltip = ({
    label,
    value,
    onChange,
    helpText,
    tooltipContent,
    min = 0,
    max = 1,
    safeMin,
    safeMax,
  }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    helpText: string;
    tooltipContent: string;
    min?: number;
    max?: number;
    safeMin?: number;
    safeMax?: number;
  }) => {
    const isInSafeRange = safeMin !== undefined && safeMax !== undefined
      ? value >= safeMin && value <= safeMax
      : true;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">{label}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>{tooltipContent}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className={`text-sm font-medium ${!isInSafeRange ? 'text-destructive' : ''}`}>
            {(value * 100).toFixed(0)}%
          </span>
        </div>
        <Slider
          value={[value]}
          onValueChange={(vals) => onChange(vals[0])}
          min={min}
          max={max}
          step={0.01}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{(min * 100).toFixed(0)}%</span>
          {safeMin !== undefined && safeMax !== undefined && (
            <span className="text-primary">
              Safe: {(safeMin * 100).toFixed(0)}%-{(safeMax * 100).toFixed(0)}%
            </span>
          )}
          <span>{(max * 100).toFixed(0)}%</span>
        </div>
        <p className="text-xs text-muted-foreground">{helpText}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 py-4">
      <SliderWithTooltip
        label="Style Strength"
        value={styleStrength}
        onChange={onStyleStrengthChange}
        helpText="Stronger style = more consistency, less variety"
        tooltipContent="Controls how strongly the AI applies the style pack's characteristics. Higher values make designs more consistent with the style but less diverse. Maps to LoRA weight."
        safeMin={0.5}
        safeMax={1.0}
      />

      <SliderWithTooltip
        label="Sharpness"
        value={sharpness}
        onChange={onSharpnessChange}
        helpText="Crisper details and defined edges"
        tooltipContent="Affects detail clarity and edge definition. Higher values create sharper, more defined features. Lower values produce softer, more blended results. Maps to CFG scale."
        safeMin={0.4}
        safeMax={0.9}
      />

      <SliderWithTooltip
        label="Realism"
        value={realism}
        onChange={onRealismChange}
        helpText="Photo-like vs. artistic interpretation"
        tooltipContent="Balances between photorealistic and artistic interpretation. Higher values prioritize realistic cake photography; lower values allow more creative, stylized designs."
        safeMin={0.6}
        safeMax={0.95}
      />

      <SliderWithTooltip
        label="Complexity"
        value={complexity}
        onChange={onComplexityChange}
        helpText="More decorations, layers & textures"
        tooltipContent="Controls decoration density and texture variety. Higher values allow intricate details, multiple layers, and complex patterns. Lower values keep designs minimal and clean."
        safeMin={0.3}
        safeMax={0.8}
      />

      <SliderWithTooltip
        label="Palette Lock"
        value={paletteLock}
        onChange={onPaletteLockChange}
        helpText="Strict palette adherence"
        tooltipContent="Determines how strictly the AI adheres to the defined color palette. 1.0 = exact palette colors only; 0.0 = allows creative color variations."
        safeMin={0.7}
        safeMax={1.0}
      />

      <SliderWithTooltip
        label="Uniformity"
        value={uniformity}
        onChange={onUniformityChange}
        helpText="Result consistency across generations"
        tooltipContent="Affects consistency between multiple generations. Higher values produce more similar results; lower values create more diverse variations for each request."
        safeMin={0.5}
        safeMax={0.9}
      />

      <div className="pt-4 border-t">
        <Label className="text-sm font-medium mb-3 block">Performance Profile</Label>
        <RadioGroup value={performanceProfile} onValueChange={onPerformanceProfileChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="draft" id="draft" />
            <Label htmlFor="draft" className="font-normal cursor-pointer">
              Draft <span className="text-muted-foreground text-xs">(Fast, 10 steps)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="standard" id="standard" />
            <Label htmlFor="standard" className="font-normal cursor-pointer">
              Standard <span className="text-muted-foreground text-xs">(Balanced, 20 steps)</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="quality" id="quality" />
            <Label htmlFor="quality" className="font-normal cursor-pointer">
              Quality <span className="text-muted-foreground text-xs">(Detailed, 40 steps)</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
