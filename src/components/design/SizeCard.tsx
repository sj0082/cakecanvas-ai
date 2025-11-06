// =============================================================================
// Size Selection Card Component
// Technical Building Block: P01 - Size Selection Interface
// =============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface SizeCardProps {
  id: string;
  name: string;
  tiersSpec: any;
  servingMin: number;
  servingMax: number;
  basePriceMin: number;
  basePriceMax: number;
  leadTime: number;
  isSelected: boolean;
  onClick: () => void;
}

export const SizeCard = ({
  name,
  tiersSpec,
  servingMin,
  servingMax,
  basePriceMin,
  basePriceMax,
  leadTime,
  isSelected,
  onClick,
}: SizeCardProps) => {
  const { t } = useTranslation();

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? "ring-2 ring-primary shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {name}
          {isSelected && <Badge variant="default">✓</Badge>}
        </CardTitle>
        <CardDescription>
          {tiersSpec?.tiers} Tier • {tiersSpec?.diameter} • {tiersSpec?.height}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('size.servings')}</span>
          <span className="font-semibold">{servingMin}-{servingMax}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('size.priceFrom')}</span>
          <span className="font-semibold">${basePriceMin}-${basePriceMax}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('size.leadTime')}</span>
          <span className="font-semibold">{leadTime} {t('size.days')}</span>
        </div>
      </CardContent>
    </Card>
  );
};
