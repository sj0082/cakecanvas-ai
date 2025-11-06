import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SizeCategory {
  id: string;
  code: string;
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
  const { toast } = useToast();

  useEffect(() => {
    fetchSizes();
  }, []);

  const fetchSizes = async () => {
    try {
      const { data, error } = await supabase
        .from("size_categories")
        .select("*")
        .eq("is_active", true)
        .order("serving_min");

      if (error) throw error;
      setSizes(data || []);
    } catch (error) {
      console.error("Error fetching sizes:", error);
      toast({
        title: "오류",
        description: "사이즈 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!selectedSize) {
      toast({
        title: "사이즈를 선택해주세요",
        description: "케이크 사이즈를 먼저 선택해야 합니다.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/design/style?size=${selectedSize}`);
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
          <Badge variant="secondary" className="mb-4">1단계</Badge>
          <h1 className="text-4xl font-bold mb-4">케이크 사이즈 선택</h1>
          <p className="text-xl text-muted-foreground">
            몇 명이 드실 케이크인가요?
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {sizes.map((size) => (
            <Card
              key={size.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedSize === size.id
                  ? "ring-2 ring-primary shadow-lg"
                  : ""
              }`}
              onClick={() => setSelectedSize(size.id)}
            >
              <CardHeader>
                <CardTitle className="text-2xl">{size.name}</CardTitle>
                <CardDescription>
                  {size.tiers_spec.tiers}단 케이크
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{size.serving_min}~{size.serving_max}명</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{size.lead_time_days}일 소요</span>
                </div>
                <div className="text-lg font-semibold text-primary">
                  ${size.base_price_min} - ${size.base_price_max}
                </div>
                {size.tiers_spec.tiers >= 2 && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>지지대 필요</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!selectedSize}
            className="px-8"
          >
            다음: 스타일 선택
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SizeSelection;
