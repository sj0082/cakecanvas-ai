import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SimpleTab } from "./SimpleTab";
import { AdvancedTab } from "./AdvancedTab";
import { PreviewPanel } from "./PreviewPanel";
import { PresetSelector } from "./PresetSelector";
import { MultiImageUpload } from "./MultiImageUpload";
import { AnalysisPanel } from "./AnalysisPanel";
import { QuickTestPanel } from "./QuickTestPanel";
import { StyleFitnessCard } from "./StyleFitnessCard";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StylePack {
  id: string;
  name: string;
  description: string | null;
  images: string[] | null;
  lora_ref: string | null;
  shape_template: string | null;
  allowed_accents: string[] | null;
  banned_terms: string[] | null;
  palette_range: any;
  is_active: boolean;
  parent_id: string | null;
  reference_stats?: any;
  generator_provider?: string;
}

interface StylePackEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stylePack: StylePack | null;
  onSave: (data: any) => Promise<void>;
}

/**
 * Supabase Storage URL에서 storage path 추출
 * URL: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
 * 반환: {path} 부분만 (예: "uploads/abc.webp")
 */
const extractStoragePath = (urlOrPath: string, bucket: string = 'stylepack-ref'): string | null => {
  // 이미 경로 형식이면 그대로 반환
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  
  // URL에서 /object/public/{bucket}/ 또는 /object/authenticated/{bucket}/ 이후 추출
  const patterns = [
    `/object/public/${bucket}/`,
    `/object/authenticated/${bucket}/`,
  ];
  
  for (const pattern of patterns) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      return urlOrPath.slice(idx + pattern.length);
    }
  }
  
  console.warn(`[extractStoragePath] Could not extract path from: ${urlOrPath}`);
  return null;
};

export const StylePackEditor = ({
  open,
  onOpenChange,
  stylePack,
  onSave,
}: StylePackEditorProps) => {
  const { toast } = useToast();
  
  // Basic fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<Array<{url: string; key: string; path?: string; bucket?: string; uploading?: boolean; error?: string; file?: File}>>([]);
  const [isActive, setIsActive] = useState(true);
  
  // Analysis
  const [referenceStats, setReferenceStats] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Simple tab controls
  const [styleStrength, setStyleStrength] = useState(0.75);
  const [sharpness, setSharpness] = useState(0.7);
  const [realism, setRealism] = useState(0.8);
  const [complexity, setComplexity] = useState(0.6);
  const [paletteLock, setPaletteLock] = useState(0.9);
  const [uniformity, setUniformity] = useState(0.7);
  const [performanceProfile, setPerformanceProfile] = useState<"draft" | "standard" | "quality">("standard");

  // Advanced tab controls
  const [loraRef, setLoraRef] = useState("cake_design_v2:0.75");
  const [shapeTemplate, setShapeTemplate] = useState("round, tiered, square, heart, custom");
  const [allowedAccents, setAllowedAccents] = useState("gold, silver, rose gold, pearl white, champagne, blush pink");
  const [bannedTerms, setBannedTerms] = useState("cartoon, anime, unrealistic, toy, plastic");
  const [paletteRange, setPaletteRange] = useState(JSON.stringify({
    primary: ["#FFFFFF", "#FFF5F5", "#FFF0F0"],
    accent: ["#FFD700", "#C0C0C0", "#F4C2C2"],
    neutral: ["#F5F5DC", "#FFFACD", "#FFF8DC"]
  }, null, 2));

  // Preview panel
  const [previews, setPreviews] = useState<string[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [seedLocked, setSeedLocked] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Preset
  const [selectedPreset, setSelectedPreset] = useState("");

  // Validation
  const [validationBadges, setValidationBadges] = useState<string[]>([]);

  // Initialize form when stylePack changes
  useEffect(() => {
    if (stylePack) {
      setName(stylePack.name || "");
      setDescription(stylePack.description || "");
      setImages((stylePack.images || []).map((url: string) => {
        const path = extractStoragePath(url, 'stylepack-ref');
        return {
          url,
          key: path || '', // path가 추출되지 않으면 빈 문자열 (분석 제외됨)
        };
      }));
      setIsActive(stylePack.is_active ?? true);
      setReferenceStats(stylePack.reference_stats || null);
      setLoraRef(stylePack.lora_ref || "cake_design_v2:0.75");
      setShapeTemplate(stylePack.shape_template || "round, tiered, square, heart, custom");
      setAllowedAccents(stylePack.allowed_accents?.join(", ") || "gold, silver, rose gold, pearl white, champagne, blush pink");
      setBannedTerms(stylePack.banned_terms?.join(", ") || "cartoon, anime, unrealistic, toy, plastic");
      setPaletteRange(JSON.stringify(stylePack.palette_range || {
        primary: ["#FFFFFF", "#FFF5F5", "#FFF0F0"],
        accent: ["#FFD700", "#C0C0C0", "#F4C2C2"],
        neutral: ["#F5F5DC", "#FFFACD", "#FFF8DC"]
      }, null, 2));
    } else {
      // Reset to defaults for new style pack
      setName("");
      setDescription("");
      setImages([]);
      setIsActive(true);
      setReferenceStats(null);
      setLoraRef("cake_design_v2:0.75");
      setShapeTemplate("round, tiered, square, heart, custom");
      setAllowedAccents("gold, silver, rose gold, pearl white, champagne, blush pink");
      setBannedTerms("cartoon, anime, unrealistic, toy, plastic");
      setPaletteRange(JSON.stringify({
        primary: ["#FFFFFF", "#FFF5F5", "#FFF0F0"],
        accent: ["#FFD700", "#C0C0C0", "#F4C2C2"],
        neutral: ["#F5F5DC", "#FFFACD", "#FFF8DC"]
      }, null, 2));
    }
  }, [stylePack]);

  const isUnpredictable = () => {
    const weight = parseFloat(loraRef.split(":")[1] || "0.75");
    return weight < 0.5 || weight > 1.0;
  };

  const handleGeneratePreview = async () => {
    setIsGeneratingPreview(true);
    try {
      // Mock preview generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      setPreviews([
        "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=400&h=400&fit=crop",
        "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=400&h=400&fit=crop",
        "https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=400&h=400&fit=crop",
      ]);
      toast({
        title: "Preview generated",
        description: "3 variants created successfully",
      });
    } catch (error) {
      toast({
        title: "Preview failed",
        description: "Could not generate preview",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    // Apply preset values
    if (presetId === "wedding-classic-v3") {
      setStyleStrength(0.8);
      setSharpness(0.75);
      setRealism(0.85);
      setComplexity(0.7);
      setPaletteLock(0.95);
      setUniformity(0.8);
    } else if (presetId === "minimal-white-v2") {
      setStyleStrength(0.65);
      setSharpness(0.8);
      setRealism(0.9);
      setComplexity(0.3);
      setPaletteLock(1.0);
      setUniformity(0.85);
    }
    toast({
      title: "Preset applied",
      description: `Loaded ${presetId} configuration`,
    });
  };

  const handleAutoAnalyze = async () => {
    // Eligible images: key exists && !temp-* && !error
    const eligible = images.filter(img => 
      img.key && 
      !img.key.startsWith('temp-') && 
      !img.error
    );
    
    console.log(`[AutoAnalyze] Eligible images:`, eligible.length, eligible);
    
    if (eligible.length < 3) {
      toast({
        title: "최소 3장 이상 필요합니다",
        description: `분석 가능: ${eligible.length}장 (성공 업로드만 집계)`,
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    const requestId = crypto.randomUUID();
    
    try {
      console.log(`[AutoAnalyze] [${requestId}] Starting analysis for ${eligible.length} images`);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const imagePaths = eligible
        .map(img => extractStoragePath(img.key, 'stylepack-ref'))
        .filter((path): path is string => path !== null && path.length > 0);

      if (imagePaths.length < 3) {
        toast({
          title: "최소 3장 이상 필요합니다",
          description: `유효한 경로: ${imagePaths.length}장`,
          variant: "destructive"
        });
        return;
      }
      
      console.log(`[AutoAnalyze] [${requestId}] Calling stylepack-analyze function with paths:`, imagePaths);
      
      const { data, error } = await supabase.functions.invoke('stylepack-analyze', {
        body: { imagePaths }
      });

      if (error) {
        console.error(`[AutoAnalyze] [${requestId}] Full error object:`, JSON.stringify(error, null, 2));
        
        // FunctionsHttpError에서 상세 정보 추출
        let errorMessage = 'Unknown error';
        let statusCode = 'unknown';
        
        if ((error as any)?.context) {
          try {
            const errorBody = await (error as any).context.json();
            statusCode = errorBody.status || (error as any).status || 'unknown';
            errorMessage = errorBody.message || errorBody.error || errorMessage;
            console.error(`[AutoAnalyze] [${requestId}] Error body:`, errorBody);
          } catch (parseError) {
            // context.json() 실패 시 기본 메시지 사용
            statusCode = (error as any)?.status || 'unknown';
            errorMessage = (error as any)?.message || error.toString();
          }
        } else {
          statusCode = (error as any)?.status || 'unknown';
          errorMessage = (error as any)?.message || error.toString();
        }
        
        throw new Error(`${statusCode}: ${errorMessage} – ${requestId}`);
      }
      
      console.log(`[AutoAnalyze] [${requestId}] Success:`, data);
      setReferenceStats(data);
      toast({
        title: "분석 완료",
        description: `팔레트 ${data.palette?.length || 0}개, 텍스처 ${data.textures?.length || 0}개 추출`
      });
    } catch (error) {
      console.error(`[AutoAnalyze] [${requestId}] Failed:`, error);
      toast({
        title: "분석 실패",
        description: error instanceof Error ? error.message : `분석 실패 – ${requestId}`,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Calculate eligible images for Auto-Analyze button
  const eligibleImagesCount = images.filter(img => 
    img.key && 
    !img.key.startsWith('temp-') && 
    !img.error
  ).length;

  const handleSave = async () => {
    try {
      const data = {
        name,
        description: description || null,
        images: images.map(img => img.url),
        lora_ref: loraRef || null,
        shape_template: shapeTemplate || null,
        allowed_accents: allowedAccents.split(",").map(s => s.trim()).filter(Boolean),
        banned_terms: bannedTerms.split(",").map(s => s.trim()).filter(Boolean),
        palette_range: JSON.parse(paletteRange || "{}"),
        reference_stats: referenceStats,
        is_active: isActive,
      };
      await onSave(data);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 mb-4">
            {stylePack ? "Edit Style Pack" : "Create Style Pack"}
          </DialogTitle>
          <StyleFitnessCard 
            stylePackId={stylePack?.id}
            imageCount={images.length}
            referenceStats={referenceStats}
          />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Panel - Form */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-2">
              {/* Basic Info */}
              <div className="space-y-4 pb-4 border-b">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              {/* Reference Images */}
              <div className="pb-4 border-b">
                <div className="flex justify-between items-center mb-4">
                  <Label className="font-semibold">Reference Images</Label>
                  <Button 
                    onClick={handleAutoAnalyze}
                    disabled={isAnalyzing || eligibleImagesCount < 3}
                    size="sm"
                    className="gap-2"
                  >
                    {isAnalyzing ? "Analyzing..." : "Auto-Analyze"}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      eligibleImagesCount >= 3 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {eligibleImagesCount}/3
                    </span>
                  </Button>
                </div>
                <MultiImageUpload
                  stylePackId={stylePack?.id || 'new'}
                  images={images}
                  onImagesChange={setImages}
                  onAnalyze={handleAutoAnalyze}
                />
              </div>

              {/* Analysis Panel */}
              {/* Analysis moved below Style Controls */}

              {/* Style Controls */}
              <div className="pb-4 border-b">
                <Label className="mb-3 block font-semibold">Style Controls</Label>
                <Tabs defaultValue="simple">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="simple">Simple</TabsTrigger>
                    <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  </TabsList>
                  <TabsContent value="simple">
                    <SimpleTab
                      styleStrength={styleStrength}
                      sharpness={sharpness}
                      realism={realism}
                      complexity={complexity}
                      paletteLock={paletteLock}
                      uniformity={uniformity}
                      performanceProfile={performanceProfile}
                      onStyleStrengthChange={setStyleStrength}
                      onSharpnessChange={setSharpness}
                      onRealismChange={setRealism}
                      onComplexityChange={setComplexity}
                      onPaletteLockChange={setPaletteLock}
                      onUniformityChange={setUniformity}
                      onPerformanceProfileChange={setPerformanceProfile}
                    />
                  </TabsContent>
                  <TabsContent value="advanced">
                    <AdvancedTab
                      loraRef={loraRef}
                      shapeTemplate={shapeTemplate}
                      allowedAccents={allowedAccents}
                      bannedTerms={bannedTerms}
                      paletteRange={paletteRange}
                      onLoraRefChange={setLoraRef}
                      onShapeTemplateChange={setShapeTemplate}
                      onAllowedAccentsChange={setAllowedAccents}
                      onBannedTermsChange={setBannedTerms}
                      onPaletteRangeChange={setPaletteRange}
                      isUnpredictable={isUnpredictable()}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              {/* Analysis Panel (moved below Style Controls) */}
              {referenceStats && (
                <div className="pb-4 border-b">
                  <AnalysisPanel
                    referenceStats={referenceStats}
                    isAnalyzing={isAnalyzing}
                  />
                </div>
              )}

              {/* Preset Library */}
              <div className="pb-4 border-b">
                <Label className="mb-2 block">Preset Library</Label>
                <PresetSelector
                  presets={[]}
                  selectedPreset={selectedPreset}
                  onPresetChange={handlePresetChange}
                  onSaveAsNew={() => toast({ title: "Save preset feature coming soon" })}
                  onRevert={() => toast({ title: "Reverted to recommended settings" })}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  id="is_active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            {/* Right Panel - Quick Test */}
            <div className="border-l pl-6 overflow-y-auto">
              <QuickTestPanel
                stylePackId={stylePack?.id}
                currentParams={{
                  strength: styleStrength,
                  cfg: sharpness,
                  steps: 32,
                  seed: Math.floor(Math.random() * 1000000)
                }}
                onTestComplete={(url) => {
                  toast({
                    title: "Preview ready",
                    description: "Sample generated successfully"
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name}>
            Save Style Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
