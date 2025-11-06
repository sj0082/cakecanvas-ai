import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StylePack {
  id: string;
  name: string;
  description: string;
  images: string[];
  allowed_accents: string[];
}

const StyleSelection = () => {
  const [styles, setStyles] = useState<StylePack[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sizeId = searchParams.get("size");

  useEffect(() => {
    if (!sizeId) {
      navigate("/design/size");
      return;
    }
    fetchStyles();
  }, [sizeId]);

  const fetchStyles = async () => {
    try {
      const { data, error } = await supabase
        .from("stylepacks")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      setStyles(data || []);
    } catch (error) {
      console.error("Error fetching styles:", error);
      toast({
        title: "오류",
        description: "스타일 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!selectedStyle) {
      toast({
        title: "스타일을 선택해주세요",
        description: "케이크 스타일을 먼저 선택해야 합니다.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/design/details?size=${sizeId}&style=${selectedStyle}`);
  };

  const handleBack = () => {
    navigate("/design/size");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">2단계</Badge>
          <h1 className="text-4xl font-bold mb-4">케이크 스타일 선택</h1>
          <p className="text-xl text-muted-foreground">
            어떤 스타일의 케이크를 원하시나요?
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {styles.map((style) => (
            <Card
              key={style.id}
              className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden ${
                selectedStyle === style.id
                  ? "ring-2 ring-primary shadow-lg"
                  : ""
              }`}
              onClick={() => setSelectedStyle(style.id)}
            >
              {style.images[0] && (
                <div className="h-48 overflow-hidden">
                  <img
                    src={style.images[0]}
                    alt={style.name}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{style.name}</CardTitle>
                <CardDescription>{style.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">장식 요소:</div>
                  <div className="flex flex-wrap gap-1">
                    {style.allowed_accents.slice(0, 4).map((accent, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {accent}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            className="px-8"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            이전: 사이즈 선택
          </Button>
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!selectedStyle}
            className="px-8"
          >
            다음: 상세 정보 입력
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StyleSelection;
