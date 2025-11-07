// =============================================================================
// Size Selection Page
// Technical Building Block: P01 - Size Selection Stepper Interface
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SizeCard } from "@/components/design/SizeCard";
import { DesignStepper } from "@/components/design/DesignStepper";


interface SizeCategory {
  id: string;
  name: string;
  tiers_spec: any;
  serving_min: number;
  serving_max: number;
  base_price_min: number;
  base_price_max: number;
  lead_time_days: number;
}

const SizeSelection = () => {
  const [sizes, setSizes] = useState<SizeCategory[]>([]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchSizes = async () => {
      const { data, error } = await supabase.from("size_categories").select("*").order("serving_min", { ascending: true });
      if (!error) setSizes(data || []);
      setLoading(false);
    };
    fetchSizes();
  }, []);

  return (
    <div className="fixed-frame">
      <div className="scrolling-content">
        <div className="min-h-full py-12 px-6">
          
          <div className="max-w-6xl mx-auto">
            <DesignStepper />
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">{t('size.badge')}</Badge>
              <h1 className="text-4xl font-bold mb-4">{t('size.title')}</h1>
              <p className="text-xl text-muted-foreground">{t('size.subtitle')}</p>
            </div>
            {loading ? <div className="text-center py-12">{t('size.loading')}</div> : (
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {sizes.map((size) => (
                  <SizeCard 
                    key={size.id}
                    id={size.id}
                    name={size.name}
                    tiersSpec={size.tiers_spec}
                    servingMin={size.serving_min}
                    servingMax={size.serving_max}
                    basePriceMin={size.base_price_min}
                    basePriceMax={size.base_price_max}
                    leadTime={size.lead_time_days}
                    isSelected={selectedSize === size.id}
                    onClick={() => setSelectedSize(size.id)}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button size="lg" onClick={() => selectedSize && navigate(`/design/style?size=${selectedSize}`)} disabled={!selectedSize} className="px-8">
                {t('size.next')}<ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SizeSelection;
