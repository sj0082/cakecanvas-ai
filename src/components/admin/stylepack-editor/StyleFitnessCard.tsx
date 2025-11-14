import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
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
      toast.error('Need at least 2 reference images to calculate fitness');
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-style-fitness', {
        body: { stylepackId: stylePackId }
      });

      if (error) throw error;

      if (data?.fitnessScores) {
        setFitnessScores(data.fitnessScores);
        toast.success('Style fitness calculated successfully');
      }
    } catch (error) {
      console.error('Failed to calculate fitness:', error);
      toast.error('Failed to calculate style fitness');
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

  if (!fitnessScores && imageCount < 2) {
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
            Upload at least 2 reference images to calculate style fitness metrics.
          </p>
          <div className="text-xs text-muted-foreground">
            <strong>Current:</strong> {imageCount} image{imageCount !== 1 ? 's' : ''}
          </div>
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
