// =============================================================================
// Style Selection Page
// Technical Building Block: P01 - Style Pack Selection Interface
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StyleCard } from "@/components/design/StyleCard";
import { DesignStepper } from "@/components/design/DesignStepper";
import { LanguageSelector } from "@/components/LanguageSelector";

const StyleSelection = () => {
  const [styles, setStyles] = useState<any[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sizeId = searchParams.get("size");

  useEffect(() => {
    const fetchStyles = async () => {
      const { data } = await supabase.from("stylepacks").select("*").order("name");
      setStyles(data || []);
      setLoading(false);
    };
    fetchStyles();
  }, []);

  return (
    <div className="fixed-frame">
      <div className="scrolling-content">
        <div className="min-h-full py-12 px-6">
          <div className="absolute top-6 right-6 z-50"><LanguageSelector /></div>
          <div className="max-w-6xl mx-auto">
            <DesignStepper />
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">{t('style.badge')}</Badge>
              <h1 className="text-4xl font-bold mb-4">{t('style.title')}</h1>
              <p className="text-xl text-muted-foreground">{t('style.subtitle')}</p>
            </div>
            {loading ? <div className="text-center py-12">{t('style.loading')}</div> : (
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {styles.map((style) => <StyleCard key={style.id} {...style} isSelected={selectedStyle === style.id} onClick={() => setSelectedStyle(style.id)} />)}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="lg" onClick={() => navigate("/design/size")} className="px-8">
                <ArrowLeft className="mr-2 h-5 w-5" />{t('style.prev')}
              </Button>
              <Button size="lg" onClick={() => selectedStyle && navigate(`/design/details?size=${sizeId}&style=${selectedStyle}`)} disabled={!selectedStyle} className="px-8">
                {t('style.next')}<ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleSelection;
