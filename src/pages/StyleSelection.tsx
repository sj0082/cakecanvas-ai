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


const StyleSelection = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [stylePacks, setStylePacks] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sizeId = searchParams.get("size");

  useEffect(() => {
    const fetchCategories = async () => {
      // Fetch level 1 categories (parent_id IS NULL)
      const { data } = await supabase
        .from("stylepacks")
        .select("*")
        .is("parent_id", null)
        .eq("is_active", true)
        .order("name");
      setCategories(data || []);
      setLoading(false);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      const fetchStylePacks = async () => {
        // Fetch level 2 style packs for selected category
        const { data } = await supabase
          .from("stylepacks")
          .select("*")
          .eq("parent_id", selectedCategory)
          .eq("is_active", true)
          .order("name");
        setStylePacks(data || []);
      };
      fetchStylePacks();
    }
  }, [selectedCategory]);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedStyle(null);
  };

  const handleBack = () => {
    if (selectedCategory) {
      setSelectedCategory(null);
      setSelectedStyle(null);
    } else {
      navigate("/design/size");
    }
  };

  const handleNext = () => {
    if (selectedStyle) {
      navigate(`/design/details?size=${sizeId}&style=${selectedStyle}`);
    }
  };

  return (
    <div className="fixed-frame">
      <div className="scrolling-content">
        <div className="min-h-full py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <DesignStepper />
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">{t('style.badge')}</Badge>
              <h1 className="text-4xl font-bold mb-4">
                {selectedCategory ? t('style.titleStylePack') : t('style.title')}
              </h1>
              <p className="text-xl text-muted-foreground">
                {selectedCategory ? t('style.subtitleStylePack') : t('style.subtitle')}
              </p>
            </div>
            {loading ? (
              <div className="text-center py-12">{t('style.loading')}</div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {!selectedCategory ? (
                  // Show level 1 categories
                  categories.map((category) => (
                    <StyleCard
                      key={category.id}
                      id={category.id}
                      name={category.name}
                      description={category.description}
                      images={category.images || []}
                      isSelected={false}
                      onClick={() => handleCategorySelect(category.id)}
                    />
                  ))
                ) : (
                  // Show level 2 style packs
                  stylePacks.map((style) => (
                    <StyleCard
                      key={style.id}
                      id={style.id}
                      name={style.name}
                      description={style.description}
                      images={style.images || []}
                      isSelected={selectedStyle === style.id}
                      onClick={() => setSelectedStyle(style.id)}
                    />
                  ))
                )}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="lg" onClick={handleBack} className="px-8">
                <ArrowLeft className="mr-2 h-5 w-5" />{t('style.prev')}
              </Button>
              <Button
                size="lg"
                onClick={handleNext}
                disabled={!selectedStyle}
                className="px-8"
              >
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
