import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";

interface Proposal {
  id: string;
  variant: string;
  image_url: string;
  spec_json: any;
  price_range_min: number;
  price_range_max: number;
  badges: string[];
  is_selected: boolean;
}

interface Request {
  id: string;
  status: string;
  contact_email: string;
}

const ProposalsView = () => {
  const { requestId } = useParams();
  const [request, setRequest] = useState<Request | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (requestId) {
      fetchData();
      // Set up real-time subscription
      const channel = supabase
        .channel(`request-${requestId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "proposals",
            filter: `request_id=eq.${requestId}`,
          },
          () => {
            fetchData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [requestId]);

  const fetchData = async () => {
    try {
      const { data: requestData, error: requestError } = await supabase
        .from("requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError) throw requestError;
      setRequest(requestData);

      const { data: proposalsData, error: proposalsError } = await supabase
        .from("proposals")
        .select("*")
        .eq("request_id", requestId)
        .order("variant");

      if (proposalsError) throw proposalsError;
      setProposals(proposalsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "오류",
        description: "데이터를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from("proposals")
        .update({ is_selected: true })
        .eq("id", proposalId);

      if (error) throw error;

      const { error: requestError } = await supabase
        .from("requests")
        .update({ status: "SELECTED" })
        .eq("id", requestId);

      if (requestError) throw requestError;

      setSelectedProposal(proposalId);
      toast({
        title: "선택 완료!",
        description: "선택하신 디자인으로 예약을 진행합니다.",
      });

      // In production, this would redirect to payment
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error selecting proposal:", error);
      toast({
        title: "오류",
        description: "선택 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>요청을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">4단계</Badge>
          <h1 className="text-4xl font-bold mb-4">AI 디자인 제안</h1>
          {proposals.length === 0 ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xl">AI가 당신만의 케이크를 디자인하고 있습니다...</p>
            </div>
          ) : (
            <p className="text-xl text-muted-foreground">
              마음에 드는 디자인을 선택해주세요
            </p>
          )}
        </div>

        {proposals.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
                <p>최고의 디자인을 위해 AI가 열심히 작업 중입니다.</p>
                <p className="text-sm text-muted-foreground">
                  완료되면 {request.contact_email}로 알림을 보내드립니다.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {proposals.map((proposal) => (
              <Card
                key={proposal.id}
                className={`transition-all hover:shadow-lg ${
                  selectedProposal === proposal.id
                    ? "ring-2 ring-primary shadow-lg"
                    : ""
                }`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="capitalize">
                        {proposal.variant === "conservative"
                          ? "보수적"
                          : proposal.variant === "standard"
                          ? "표준"
                          : "대담한"}{" "}
                        디자인
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {proposal.variant === "conservative"
                          ? "안전하고 클래식한 스타일"
                          : proposal.variant === "standard"
                          ? "균형잡힌 중간 스타일"
                          : "독특하고 창의적인 스타일"}
                      </CardDescription>
                    </div>
                    {proposal.is_selected && (
                      <CheckCircle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">디자인 이미지</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {proposal.badges.map((badge, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {badge}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-lg font-semibold text-primary">
                      ${proposal.price_range_min} - ${proposal.price_range_max}
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleSelectProposal(proposal.id)}
                    disabled={!!selectedProposal}
                  >
                    {selectedProposal === proposal.id
                      ? "선택됨"
                      : "이 디자인 선택"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalsView;
