import { Badge } from "@/components/ui/badge";
import { AlertCircle, Palette, Layers } from "lucide-react";

interface AnalysisPanelProps {
  referenceStats: {
    palette?: Array<{ hex: string; hsl: number[]; name: string }>;
    textures?: string[];
    techniques?: string[];
    safety?: {
      hasBannedContent: boolean;
      flags: string[];
      confidence: number;
    };
  } | null;
  isAnalyzing: boolean;
}

export const AnalysisPanel = ({ referenceStats, isAnalyzing }: AnalysisPanelProps) => {
  if (isAnalyzing) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <div className="animate-pulse">
          <Layers className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Analyzing images...</p>
        </div>
      </div>
    );
  }

  if (!referenceStats) {
    return (
      <div className="border rounded-lg p-6 text-center">
        <Palette className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Upload images and click "Auto-Analyze" to extract palette and textures
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Analysis Results
      </h3>

      {referenceStats.palette && referenceStats.palette.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Color Palette</p>
          <div className="flex flex-wrap gap-2">
            {referenceStats.palette.map((color, idx) => (
              <div key={idx} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: color.hex }}
                />
                <div className="text-xs">
                  <div className="font-medium">{color.name}</div>
                  <div className="text-muted-foreground">{color.hex}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {referenceStats.textures && referenceStats.textures.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Textures & Techniques</p>
          <div className="flex flex-wrap gap-2">
            {referenceStats.textures.map((texture, idx) => (
              <Badge key={idx} variant="secondary">{texture}</Badge>
            ))}
            {referenceStats.techniques?.map((tech, idx) => (
              <Badge key={`tech-${idx}`} variant="outline">{tech}</Badge>
            ))}
          </div>
        </div>
      )}

      {referenceStats.safety?.hasBannedContent && (
        <div className="bg-destructive/10 border-destructive border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm font-medium text-destructive">Safety Warning</p>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Detected potentially problematic content:
          </p>
          <div className="flex flex-wrap gap-2">
            {referenceStats.safety.flags.map((flag, idx) => (
              <Badge key={idx} variant="destructive">{flag}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Confidence: {Math.round((referenceStats.safety.confidence || 0) * 100)}%
          </p>
        </div>
      )}
    </div>
  );
};
