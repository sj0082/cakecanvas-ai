// =============================================================================
// Proposals View Page
// Technical Building Block: P02 - Proposal Card Display & Selection  
// =============================================================================

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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

      try {
        // Construct Edge Function URL
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const functionUrl = `${supabaseUrl}/functions/v1/get-request?requestId=${requestId}&token=${accessToken}`;
        
        const response = await fetch(functionUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to fetch request');
          setLoading(false);
          return;
        }

        const requestData = await response.json();
        setRequest(requestData);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching request:', err);
        setError('Failed to load request data');
        setLoading(false);
      }
    };

    fetchRequest();

    // Poll for updates every 5 seconds while request is GENERATING
    const pollInterval = setInterval(() => {
      if (request?.status === "GENERATING") {
        fetchRequest();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [requestId, accessToken, request?.status]);

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
