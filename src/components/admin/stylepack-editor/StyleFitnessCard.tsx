import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface StyleFitnessCardProps {
  stylePackId?: string;
  imageCount: number;
  referenceStats: any;
}

interface FitnessScores {
  consistency: number;
  palette_drift: number;
  layout_fit: number;
}

export const StyleFitnessCard = ({ stylePackId, imageCount, referenceStats }: StyleFitnessCardProps) => {
  const [fitnessScores, setFitnessScores] = useState<FitnessScores | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    if (referenceStats?.fitness_scores) {
      setFitnessScores(referenceStats.fitness_scores);
    }
  }, [referenceStats]);

  const calculateFitness = async () => {
    if (!stylePackId) {
      toast.error('Style pack ID is required');
      return;
    }

    if (imageCount < 2) {
      toast.error('최소 2장의 참조 이미지가 필요합니다. 먼저 Auto-Analyze를 실행해주세요.');
      return;
    }

    setIsCalculating(true);
    console.log('[StyleFitnessCard] Starting fitness calculation for:', stylePackId);
    
    try {
      const { data, error } = await supabase.functions.invoke('calculate-style-fitness', {
        body: { stylepackId: stylePackId }
      });

      console.log('[StyleFitnessCard] Raw response:', { data, error });

      if (error) {
        console.error('[StyleFitnessCard] Error object:', error);
        console.error('[StyleFitnessCard] Error type:', error.constructor.name);
        
        let errorMessage = '알 수 없는 오류가 발생했습니다';
        let errorDetails = '';
        
        try {
          // For FunctionsHttpError, try multiple ways to get the error body
          let errorBody = null;
          
          // Method 1: Check error.context (newer Supabase client)
          if (error.context && typeof error.context === 'object') {
            errorBody = error.context;
            console.log('[StyleFitnessCard] Error from context:', errorBody);
          }
          // Method 2: Try parsing error.message if it's JSON
          else if (typeof error.message === 'string') {
            try {
              errorBody = JSON.parse(error.message);
              console.log('[StyleFitnessCard] Error from parsed message:', errorBody);
            } catch (e) {
              console.log('[StyleFitnessCard] Message is not JSON:', error.message);
            }
          }
          
          // Process the error body if we got it
          if (errorBody) {
            if (errorBody.error === 'INSUFFICIENT_REFERENCE_IMAGES') {
              errorMessage = errorBody.message;
              errorDetails = errorBody.details;
            } else if (errorBody.error === 'MISSING_EMBEDDINGS') {
              errorMessage = errorBody.message;
              errorDetails = errorBody.details;
            } else if (errorBody.error || errorBody.message) {
              errorMessage = errorBody.message || errorBody.error;
              errorDetails = errorBody.details || '';
            }
          } else {
            // Fallback: use error.message directly
            errorMessage = error.message || '알 수 없는 오류가 발생했습니다';
          }
        } catch (parseError) {
          console.error('[StyleFitnessCard] Failed to parse error:', parseError);
          errorMessage = error.message || '알 수 없는 오류가 발생했습니다';
        }
        
        toast.error(errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage);
        return;
      }

      // Success case - fetch updated fitness scores from database
      console.log('[StyleFitnessCard] Fitness calculation successful:', data);
      
      const { data: updatedStylepack, error: fetchError } = await supabase
        .from('stylepacks')
        .select('fitness_scores')
        .eq('id', stylePackId)
        .maybeSingle();
      
      if (fetchError) {
        console.error('[StyleFitnessCard] Failed to fetch updated scores:', fetchError);
        toast.error('점수는 계산되었지만 업데이트에 실패했습니다. 페이지를 새로고침해주세요.');
        return;
      }
      
      if (updatedStylepack?.fitness_scores) {
        console.log('[StyleFitnessCard] Updated fitness scores from DB:', updatedStylepack.fitness_scores);
        const scores = updatedStylepack.fitness_scores as unknown as FitnessScores;
        setFitnessScores(scores);
        toast.success('Style Fitness 점수가 성공적으로 계산되었습니다!');
      } else {
        console.warn('[StyleFitnessCard] No fitness scores found in DB');
        toast.error('점수 계산은 완료되었으나 데이터를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('[StyleFitnessCard] Unexpected error:', error);
      toast.error(error instanceof Error ? error.message : '예상치 못한 오류가 발생했습니다');
    } finally {
      setIsCalculating(false);
    }
  };

  const getOverallScore = (): number => {
    if (!fitnessScores) return 0;
    // Weighted average: consistency 40%, palette_drift 35%, layout_fit 25%
    return (
      fitnessScores.consistency * 40 +
      (1 - fitnessScores.palette_drift) * 35 + // Lower drift is better
      fitnessScores.layout_fit * 25
    );
  };

  const overallScore = getOverallScore();

  const getScoreColor = (score: number) => {
    if (score >= 80) return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Excellent" };
    if (score >= 60) return { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", label: "Good" };
    return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Needs Improvement" };
  };

  const scoreInfo = getScoreColor(overallScore);
  const ScoreIcon = scoreInfo.icon;

  // Phase 4.2: Check if Auto-Analyze has been run
  const analyzedCount = referenceStats?.analyzed_count || 0;
  const hasAnalyzedImages = analyzedCount >= 2;
  
  // If not enough images uploaded
  if (imageCount < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Style Fitness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            최소 2장의 참조 이미지가 필요합니다. 이미지를 업로드한 후 "Auto-Analyze" 버튼을 클릭해주세요.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // If images uploaded but Auto-Analyze not run yet
  if (imageCount >= 2 && !hasAnalyzedImages) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Action Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Auto-Analyze를 먼저 실행해주세요</AlertTitle>
            <AlertDescription>
              {imageCount}개의 이미지가 업로드되었지만 아직 분석되지 않았습니다. 
              아래 "Reference Images" 섹션에서 "Auto-Analyze" 버튼을 클릭하여 이미지를 분석한 후 Calculate를 실행해주세요.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={fitnessScores ? scoreInfo.bg : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {fitnessScores && <ScoreIcon className={`h-5 w-5 ${scoreInfo.color}`} />}
            Style Fitness
          </CardTitle>
          <Button
            onClick={calculateFitness}
            disabled={isCalculating || imageCount < 2}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
            Calculate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fitnessScores ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Overall Score</span>
              <Badge variant={overallScore >= 80 ? "default" : overallScore >= 60 ? "secondary" : "destructive"}>
                {overallScore.toFixed(0)}/100
              </Badge>
            </div>

            {/* Consistency */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Consistency</span>
                <span className="text-sm text-muted-foreground">
                  {(fitnessScores.consistency * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={fitnessScores.consistency * 100} />
              <p className="text-xs text-muted-foreground mt-1">
                Visual consistency across reference images
              </p>
            </div>

            {/* Palette Accuracy */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Palette Accuracy</span>
                <span className="text-sm text-muted-foreground">
                  {((1 - fitnessScores.palette_drift) * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={(1 - fitnessScores.palette_drift) * 100} />
              <p className="text-xs text-muted-foreground mt-1">
                Color consistency (lower drift = better)
              </p>
            </div>

            {/* Layout Fit */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Layout Fit</span>
                <span className="text-sm text-muted-foreground">
                  {(fitnessScores.layout_fit * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={fitnessScores.layout_fit * 100} />
              <p className="text-xs text-muted-foreground mt-1">
                Fit with standard cake layouts
              </p>
            </div>

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                <strong>{scoreInfo.label}:</strong>{" "}
                {overallScore >= 80 && "This style pack is well-configured and ready for production use."}
                {overallScore >= 60 && overallScore < 80 && "Add more reference images for better results."}
                {overallScore < 60 && "Upload more reference images and ensure consistency in visual style."}
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Click "Calculate" to analyze style fitness metrics
            </p>
            <div className="text-xs text-muted-foreground">
              <strong>Reference images:</strong> {imageCount}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
