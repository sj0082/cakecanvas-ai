import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Lock, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface PreviewPanelProps {
  isLoading: boolean;
  previews: string[];
  seedLocked: boolean;
  onToggleSeedLock: () => void;
  onGeneratePreview: () => void;
  showComparison: boolean;
  onToggleComparison: () => void;
  estimatedCost?: number;
  estimatedTime?: number;
}

export const PreviewPanel = ({
  isLoading,
  previews,
  seedLocked,
  onToggleSeedLock,
  onGeneratePreview,
  showComparison,
  onToggleComparison,
  estimatedCost = 0.03,
  estimatedTime = 8,
}: PreviewPanelProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Preview</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleSeedLock}
            className="gap-2"
          >
            {seedLocked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            {seedLocked ? "Locked" : "Unlocked"}
          </Button>
          <Button
            onClick={onGeneratePreview}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate Preview
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div>Est. time: ~{estimatedTime}s</div>
        <div>Est. cost: ${estimatedCost.toFixed(3)}</div>
        <Badge variant="secondary" className="text-xs">
          512×512 • Fast Mode
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="comparison"
          checked={showComparison}
          onCheckedChange={onToggleComparison}
        />
        <Label htmlFor="comparison" className="text-sm font-normal cursor-pointer">
          A/B Compare with saved
        </Label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-square bg-muted animate-pulse rounded-lg flex items-center justify-center"
              >
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ))}
          </>
        ) : previews.length > 0 ? (
          <>
            {previews.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url}
                  alt={`Preview ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border shadow-sm"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Badge variant="secondary" className="text-xs">
                    Variant {i + 1}
                  </Badge>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="col-span-3 aspect-square bg-muted/30 border-2 border-dashed rounded-lg flex items-center justify-center text-sm text-muted-foreground">
            Click "Generate Preview" to see results
          </div>
        )}
      </div>

      {previews.length > 0 && (
        <div className="text-xs text-muted-foreground text-center pt-2">
          Preview watermarked • Not for production use
        </div>
      )}
    </div>
  );
};
