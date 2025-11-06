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
  tiersSpec: {
    tiers: number;
    diameter: string;
    height: string;
  };
  serving: number;
  basePrice: number;
  leadTime: number;
  isSelected: boolean;
  onClick: () => void;
}

export const SizeCard = ({
  name,
  tiersSpec,
  serving,
  basePrice,
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
          {tiersSpec.tiers} Tier • {tiersSpec.diameter} • {tiersSpec.height}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('size.servings')}</span>
          <span className="font-semibold">{serving}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('size.priceFrom')}</span>
          <span className="font-semibold">${basePrice}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('size.leadTime')}</span>
          <span className="font-semibold">{leadTime} {t('size.days')}</span>
        </div>
      </CardContent>
    </Card>
  );
};
