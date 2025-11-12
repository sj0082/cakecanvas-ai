import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Zap, Loader2, Clock, DollarSign } from "lucide-react";

interface QuickTestPanelProps {
  stylePackId?: string;
  stylePackName?: string;
  referenceImages: string[];
  currentParams: any;
  onTestComplete?: (imageUrl: string) => void;
}

export const QuickTestPanel = ({ stylePackId, stylePackName, referenceImages, currentParams, onTestComplete }: QuickTestPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [seedLocked, setSeedLocked] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  const handleQuickTest = async () => {
    if (referenceImages.length === 0) {
      console.error('No reference images available');
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      // Extract storage path from first reference image URL
      const firstImageUrl = referenceImages[0];
      const pathMatch = firstImageUrl.match(/\/object\/public\/stylepack-ref\/(.+)$/);
      const referenceImagePath = pathMatch ? pathMatch[1] : firstImageUrl;

      console.log('Calling stylepack-quick-test with:', {
        referenceImagePath,
        stylePackName,
        currentParams
      });

      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('stylepack-quick-test', {
        body: {
          referenceImagePath,
          stylePackName,
          params: currentParams,
          lockSeed: seedLocked
        }
      });

      if (error) {
        console.error('Quick test error:', error);
        throw error;
      }

      console.log('Quick test success:', data);
      
      setPreview(data.imageUrl);
      setGenerationTime(data.generationTime);
      
      if (onTestComplete) {
        onTestComplete(data.imageUrl);
      }
    } catch (error) {
      console.error('Quick test error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Quick Test</h3>
        <div className="flex items-center gap-2">
          <Checkbox
            id="seed-lock"
            checked={seedLocked}
            onCheckedChange={(checked) => setSeedLocked(checked as boolean)}
          />
          <Label htmlFor="seed-lock" className="text-sm cursor-pointer">
            Lock Seed
          </Label>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Generate a sample image with current settings to preview the style pack output
      </p>

      <Button
        onClick={handleQuickTest}
        disabled={isGenerating || referenceImages.length === 0}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Zap className="mr-2 h-4 w-4" />
            Generate Preview
          </>
        )}
      </Button>

      {preview && (
        <div className="space-y-3">
          <div className="aspect-square rounded-lg overflow-hidden border">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {generationTime ? `${(generationTime / 1000).toFixed(1)}s` : '-'}
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              ~$0.002
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Settings:</strong></p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Resolution: 512×512</li>
          <li>Steps: 10-14 (fast draft)</li>
          <li>Strength: {currentParams?.strength || 0.75}</li>
          <li>CFG: {currentParams?.cfg || 6.5}</li>
        </ul>
      </div>
    </div>
  );
};
