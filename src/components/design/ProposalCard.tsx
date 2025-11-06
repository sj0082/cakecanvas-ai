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
  variant: "conservative" | "standard" | "bold";
  image_url: string;
  spec_json: {
    tiers?: string;
    palette?: string;
    accents?: string[];
  };
  price_range_min: number;
  price_range_max: number;
  badges: string[];
  isSelected: boolean;
  onSelect: () => void;
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
}: ProposalCardProps) => {
  const { t } = useTranslation();

  const getBadgeVariant = (badge: string) => {
    if (badge.includes("risk") || badge.includes("warning")) return "destructive";
    if (badge.includes("required")) return "secondary";
    return "outline";
  };

  return (
    <Card className={`${isSelected ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <CardHeader className="p-0">
        <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
          <img
            src={image_url}
            alt={`${variant} proposal`}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2">
            <Badge variant="default">{t(`proposals.variant.${variant}`)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div>
          <CardTitle className="text-lg mb-2 capitalize">{variant}</CardTitle>
          <CardDescription className="space-y-1">
            {spec_json.tiers && <div>Tiers: {spec_json.tiers}</div>}
            {spec_json.palette && <div>Palette: {spec_json.palette}</div>}
            {spec_json.accents && spec_json.accents.length > 0 && (
              <div>Accents: {spec_json.accents.join(", ")}</div>
            )}
          </CardDescription>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">
            {t('proposals.priceRange')}: ${price_range_min} - ${price_range_max}
          </div>
          
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {badges.map((badge, idx) => (
                <Badge key={idx} variant={getBadgeVariant(badge) as any} className="text-xs">
                  {t(`proposals.badges.${badge}`) || badge}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={onSelect}
          variant={isSelected ? "default" : "outline"}
          className="w-full"
        >
          {isSelected ? t('proposals.selected') : t('proposals.select')}
        </Button>
      </CardContent>
    </Card>
  );
};
