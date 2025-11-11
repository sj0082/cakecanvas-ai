import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface StyleFitnessCardProps {
  stylePackId?: string;
  imageCount: number;
  referenceStats: any;
}

export const StyleFitnessCard = ({ stylePackId, imageCount, referenceStats }: StyleFitnessCardProps) => {
  const calculateFitnessScore = (): number => {
    let score = 0;
    
    // Image count (0-30 points)
    if (imageCount >= 5) score += 30;
    else if (imageCount >= 3) score += 20;
    else if (imageCount >= 1) score += 10;
    
    // Palette consistency (0-35 points)
    if (referenceStats?.palette?.length >= 5) score += 35;
    else if (referenceStats?.palette?.length >= 3) score += 20;
    
    // Texture variety (0-20 points)
    if (referenceStats?.textures?.length >= 3) score += 20;
    else if (referenceStats?.textures?.length >= 1) score += 10;
    
    // Safety (0-15 points)
    if (!referenceStats?.safety?.hasBannedContent) score += 15;
    
    return score;
  };

  const score = calculateFitnessScore();
  
  const getScoreColor = () => {
    if (score >= 90) return { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", label: "Excellent" };
    if (score >= 70) return { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", label: "Good" };
    return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Needs Improvement" };
  };

  const scoreInfo = getScoreColor();
  const ScoreIcon = scoreInfo.icon;

  return (
    <div className={`border rounded-lg p-4 ${scoreInfo.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ScoreIcon className={`h-5 w-5 ${scoreInfo.color}`} />
          <h3 className="font-medium">Style Fitness</h3>
        </div>
        <Badge variant={score >= 90 ? "default" : score >= 70 ? "secondary" : "destructive"}>
          {score}/100
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Images</p>
          <p className="font-medium">{imageCount}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Palette</p>
          <p className="font-medium">{referenceStats?.palette?.length || 0} colors</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Textures</p>
          <p className="font-medium">{referenceStats?.textures?.length || 0} types</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Safety</p>
          <p className="font-medium">
            {referenceStats?.safety?.hasBannedContent ? "⚠️ Issues" : "✓ Clean"}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t">
        <p className="text-xs text-muted-foreground">
          <strong>{scoreInfo.label}:</strong>{" "}
          {score >= 90 && "This style pack is well-configured and ready for production use."}
          {score >= 70 && score < 90 && "Add more reference images and complete the analysis for better results."}
          {score < 70 && "Upload at least 3 reference images and run auto-analysis to improve quality."}
        </p>
      </div>
    </div>
  );
};
