// =============================================================================
// Proposals View Page
// Technical Building Block: P02 - Proposal Card Display & Selection  
// =============================================================================

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ProposalCard } from "@/components/design/ProposalCard";
import { DesignStepper } from "@/components/design/DesignStepper";


const ProposalsView = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<any>(null);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  
  // Get access token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('token');

  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId) {
        setError('Request ID is missing');
        setLoading(false);
        return;
      }

      if (!accessToken) {
        setError('Access token is required');
        setLoading(false);
        return;
      }

      // Fetch request with token validation
      const { data: requestData, error: requestError } = await supabase
        .from("requests")
        .select("*")
        .eq("id", requestId)
        .eq("access_token", accessToken)
        .single();

      if (requestError || !requestData) {
        setError('Invalid access token or request not found');
        setLoading(false);
        return;
      }

      // Fetch proposals for this request
      const { data: proposalsData } = await supabase
        .from("proposals")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at");
      
      setRequest({ ...requestData, proposals: proposalsData || [] });
      setError(null);
      setLoading(false);
    };

    fetchRequest();
    const channel = supabase.channel(`request-${requestId}`).on("postgres_changes", { event: "*", schema: "public", table: "proposals", filter: `request_id=eq.${requestId}` }, fetchRequest).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, accessToken]);

  if (loading || !request || error) return (
    <div className="fixed-frame">
      <div className="scrolling-content">
        <div className="min-h-full py-12 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                {loading ? t('proposals.loading') : error || t('common.error')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed-frame">
      <div className="scrolling-content">
        <div className="min-h-full py-12 px-6">
          
          <div className="max-w-6xl mx-auto">
            <DesignStepper />
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">{t('proposals.badge')}</Badge>
              <h1 className="text-4xl font-bold mb-4">{t('proposals.title')}</h1>
              <p className="text-xl text-muted-foreground">{t('proposals.subtitle')}</p>
            </div>
            {request.status === "GENERATING" && request.proposals.length === 0 ? (
              <div className="text-center py-12"><p className="text-muted-foreground">{t('proposals.status.generating')}</p></div>
            ) : request.proposals.length > 0 ? (
              <>
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  {request.proposals.map((proposal: any) => <ProposalCard key={proposal.id} {...proposal} isSelected={selectedProposal === proposal.id} onSelect={() => setSelectedProposal(proposal.id)} />)}
                </div>
                {selectedProposal && (
                  <div className="text-center p-6 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">{t('proposals.contactInfo')} {request.contact_email}</p>
                    <p className="text-xs text-muted-foreground">{t('proposals.next')}</p>
                  </div>
                )}
              </>
            ) : <div className="text-center py-12"><p className="text-muted-foreground">{t('proposals.status.failed')}</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalsView;
