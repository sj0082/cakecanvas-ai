import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DesignDetails = () => {
  const [userText, setUserText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sizeId = searchParams.get("size");
  const styleId = searchParams.get("style");

  const handleSubmit = async () => {
    if (!sizeId || !styleId) {
      toast({
        title: "오류",
        description: "사이즈와 스타일을 먼저 선택해주세요.",
        variant: "destructive",
      });
      navigate("/design/size");
      return;
    }

    if (!contactEmail) {
      toast({
        title: "이메일을 입력해주세요",
        description: "결과를 받을 이메일 주소가 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("requests")
        .insert({
          size_category_id: sizeId,
          stylepack_id: styleId,
          user_text: userText || null,
          contact_email: contactEmail,
          contact_phone: contactPhone || null,
          status: "GENERATING"
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "요청이 접수되었습니다!",
        description: "AI가 디자인을 생성하고 있습니다. 잠시만 기다려주세요.",
      });

      navigate(`/design/proposals/${data.id}`);
    } catch (error) {
      console.error("Error creating request:", error);
      toast({
        title: "오류",
        description: "요청 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/design/style?size=${sizeId}`);
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">3단계</Badge>
          <h1 className="text-4xl font-bold mb-4">추가 정보 입력</h1>
          <p className="text-xl text-muted-foreground">
            원하는 케이크에 대해 더 자세히 알려주세요 (선택사항)
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>케이크 디자인 요청사항</CardTitle>
            <CardDescription>
              테마, 색상, 문구, 특별한 요청사항 등을 자유롭게 작성해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="user-text">디자인 요청사항</Label>
              <Textarea
                id="user-text"
                placeholder="예: 핑크와 골드 컬러로, 장미 장식, '생일 축하합니다' 문구 포함"
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                rows={5}
              />
              <p className="text-sm text-muted-foreground">
                구체적으로 작성할수록 더 정확한 디자인을 받을 수 있습니다
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>연락처 정보</CardTitle>
            <CardDescription>
              디자인 제안과 결제 정보를 받을 연락처를 입력해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일 주소 *</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호 (선택)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="010-1234-5678"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            disabled={loading}
            className="px-8"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            이전: 스타일 선택
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={loading || !contactEmail}
            className="px-8"
          >
            {loading ? (
              "생성 중..."
            ) : (
              <>
                AI 디자인 생성
                <Sparkles className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DesignDetails;
