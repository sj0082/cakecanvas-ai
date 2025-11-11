// =============================================================================
// Style Pack Selection Card Component
// Technical Building Block: P01 - Style Pack Selection Interface
// =============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StyleCardProps {
  id: string;
  name: string;
  images: string[];
  isSelected: boolean;
  onClick: () => void;
}

export const StyleCard = ({
  name,
  images,
  isSelected,
  onClick,
}: StyleCardProps) => {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? "ring-2 ring-primary shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="p-0">
        <div className="aspect-square relative overflow-hidden rounded-t-lg">
          <img
            src={images[0]}
            alt={name}
            className="w-full h-full object-cover"
          />
          {isSelected && (
            <div className="absolute top-2 right-2">
              <Badge variant="default">✓</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-2">{name}</CardTitle>
      </CardContent>
    </Card>
  );
};
