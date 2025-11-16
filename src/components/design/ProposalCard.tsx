// =============================================================================
// Proposal Card Component
// Technical Building Block: P02 - Proposal Card UI with Reality Badges
// =============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface ProposalCardProps {
  id: string;
  variant: "conservative" | "standard" | "bold" | "customer-priority" | "balanced" | "stylepack-priority";
  image_url: string;
  spec_json: {
    tiers?: string;
    palette?: string;
    accents?: string[];
    variantLabel?: string;
    variant?: string;
  };
  price_range_min: number;
  price_range_max: number;
  badges: string[];
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export const ProposalCard = ({
  variant,
  image_url,
  spec_json,
  price_range_min,
  price_range_max,
  badges,
  isSelected,
  onSelect,
  disabled = false,
}: ProposalCardProps) => {
  const { t } = useTranslation();
  const spec = typeof spec_json === 'string' ? JSON.parse(spec_json) : spec_json;
  const actualVariant = spec?.variant || variant;
  
  // Map old variant names to new V1/V2/V3 labels
  const variantLabelMap: Record<string, string> = {
    'conservative': 'V1-Customer Priority',
    'customer-priority': 'V1-Customer Priority',
    'standard': 'V2-Balanced',
    'balanced': 'V2-Balanced',
    'bold': 'V3-StylePack Priority',
    'stylepack-priority': 'V3-StylePack Priority'
  };
  
  const displayLabel = variantLabelMap[actualVariant] || spec?.variantLabel || t(`proposals.variant.${actualVariant}`);

  const getBadgeVariant = (badge: string) => {
    if (badge.includes("risk") || badge.includes("warning")) return "destructive";
    if (badge.includes("required")) return "secondary";
    return "outline";
  };

  return (
    <Card className={`overflow-hidden transition-transform duration-200 ease-smooth hover:scale-[1.01] ${isSelected ? "ring-2 ring-brand shadow-elegant" : ""}`}>
      <CardHeader className="p-0">
        <div className="aspect-square relative bg-muted">
          <img
            src={image_url}
            alt={`${variant} proposal`}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <Badge variant="default">{displayLabel}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="text-lg capitalize">{variant}</CardTitle>
          <span className="text-sm text-muted-foreground font-semibold">
            ${price_range_min} - ${price_range_max}
          </span>
        </div>
        
        <CardDescription className="space-y-1 mb-4">
          {spec_json.tiers && <div>Tiers: {spec_json.tiers}</div>}
          {spec_json.palette && <div>Palette: {spec_json.palette}</div>}
          {spec_json.accents && spec_json.accents.length > 0 && (
            <div>Accents: {spec_json.accents.join(", ")}</div>
          )}
        </CardDescription>
        
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {badges.map((badge, idx) => (
              <Badge key={idx} variant={getBadgeVariant(badge) as any}>
                {t(`proposals.badges.${badge}`) || badge}
              </Badge>
            ))}
          </div>
        )}

        <Button
          onClick={onSelect}
          variant={isSelected ? "default" : "outline"}
          className="w-full"
          disabled={disabled}
        >
          {disabled 
            ? t('proposals.submitting') 
            : isSelected 
            ? t('proposals.selected') 
            : t('proposals.select')
          }
        </Button>
      </CardContent>
    </Card>
  );
};
