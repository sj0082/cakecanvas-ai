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
  const [selectedStyleRefCount, setSelectedStyleRefCount] = useState<number>(0);
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
        // Fetch level 2 style packs for selected category with ref image count
        const { data } = await supabase
          .from("stylepacks")
          .select(`
            *,
            stylepack_ref_images(count)
          `)
          .eq("parent_id", selectedCategory)
          .eq("is_active", true)
          .order("name");
        
        // Transform data to include ref_image_count
        const transformedData = (data || []).map((sp: any) => ({
          ...sp,
          ref_image_count: sp.stylepack_ref_images?.[0]?.count || 0
        }));
        
        setStylePacks(transformedData);
      };
      fetchStylePacks();
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedStyle) {
      const fetchRefImageCount = async () => {
        const { count } = await supabase
          .from("stylepack_ref_images")
          .select("*", { count: 'exact', head: true })
          .eq("stylepack_id", selectedStyle);
        setSelectedStyleRefCount(count || 0);
      };
      fetchRefImageCount();
    }
  }, [selectedStyle]);

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
    if (selectedStyle && selectedStyleRefCount >= 2) {
      navigate(`/design/details?size=${sizeId}&style=${selectedStyle}`);
    }
  };

  const canProceed = selectedStyle && selectedStyleRefCount >= 2;

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
                  stylePacks.map((pack) => {
                    const hasEnoughImages = pack.ref_image_count >= 2;
                    return (
                      <div key={pack.id} className="relative">
                        <StyleCard
                          id={pack.id}
                          name={pack.name}
                          description={pack.description}
                          images={pack.images || []}
                          isSelected={pack.id === selectedStyle}
                          onClick={() => setSelectedStyle(pack.id)}
                        />
                        {!hasEnoughImages && (
                          <div className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
                            ⚠️ No reference images
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            
            {selectedStyle && selectedStyleRefCount < 2 && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ This style pack requires at least 2 reference images to generate designs.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Currently has {selectedStyleRefCount} image(s). Please contact an administrator to add reference images.
                </p>
              </div>
            )}
            
            <div className="flex justify-between">
              <Button variant="outline" size="lg" onClick={handleBack} className="px-8">
                <ArrowLeft className="mr-2 h-5 w-5" />{t('style.prev')}
              </Button>
              <Button
                size="lg"
                onClick={handleNext}
                disabled={!canProceed}
                className="px-8"
                title={!canProceed && selectedStyle ? "This style pack needs reference images" : ""}
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
