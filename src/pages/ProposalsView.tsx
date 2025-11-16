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
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, Check } from "lucide-react";


const ProposalsView = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<any>(null);
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { toast } = useToast();
  
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
    // Stop after 5 minutes (60 polls) to prevent infinite polling
    const MAX_POLLS = 60;
    const pollInterval = setInterval(() => {
      if (request?.status === "GENERATING") {
        setPollingCount(prev => {
          const newCount = prev + 1;
          if (newCount >= MAX_POLLS) {
            setError('Generation is taking longer than expected. Please refresh the page or contact support.');
            clearInterval(pollInterval);
          }
          return newCount;
        });
        fetchRequest();
      } else {
        clearInterval(pollInterval);
      }
    }, 5000);

    // Check for successful payment on mount
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId && !submitSuccess) {
      setSubmitSuccess(true);
      toast({
        title: t('proposals.paymentSuccess'),
        description: t('proposals.paymentSuccessDescription', { email: request?.contact_email || '' }),
      });
    }

    return () => {
      clearInterval(pollInterval);
    };
  }, [requestId, accessToken, request?.status, submitSuccess, toast, t]);

  const handleSelectProposal = async (proposalId: string) => {
    if (!requestId || !accessToken || submitting) return;
    
    setSubmitting(true);
    setSubmitError(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/create-stripe-checkout`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          proposalId,
          accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;
      
    } catch (error) {
      console.error('Error creating checkout:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to start payment process');
      toast({
        title: t('common.error'),
        description: t('proposals.paymentError'),
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

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
            {request.status === "FAILED" ? (
              <div className="text-center py-12">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md mx-auto">
                  <p className="text-destructive font-semibold mb-2">Generation Failed</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    We encountered an error while generating your cake designs. 
                    This usually happens when the selected style pack doesn't have enough reference images (minimum 2 required).
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Please try selecting a different style pack or contact support if the problem persists.
                  </p>
                  <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                    Request ID: {requestId}
                  </p>
                </div>
              </div>
            ) : request.status === "GENERATING" && request.proposals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-2">{t('proposals.status.generating')}</p>
                <p className="text-xs text-muted-foreground">This usually takes 20-40 seconds...</p>
                {pollingCount > 6 && (
                  <p className="text-xs text-muted-foreground mt-2">Still working on it... ({pollingCount * 5}s elapsed)</p>
                )}
              </div>
            ) : request.proposals.length > 0 ? (
              <>
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  {request.proposals.map((proposal: any) => <ProposalCard key={proposal.id} {...proposal} isSelected={selectedProposal === proposal.id} onSelect={() => setSelectedProposal(proposal.id)} />)}
                </div>
                {selectedProposal && !submitSuccess && (
                  <div className="text-center p-6 bg-gradient-to-r from-brand/10 to-brand/5 border border-brand/20 rounded-lg">
                    <p className="text-sm font-medium mb-4">
                      {t('proposals.readyToRequest')}
                    </p>
                    <Button
                      onClick={() => handleSelectProposal(selectedProposal)}
                      disabled={submitting}
                      size="lg"
                      className="min-w-[250px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('proposals.processingPayment')}
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          {t('proposals.proceedToPayment')} - $30 USD
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      {t('proposals.paymentInfo')}
                    </p>
                  </div>
                )}

                {submitSuccess && (
                  <div className="text-center p-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-center mb-3">
                      <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-green-800 dark:text-green-300 font-semibold mb-2">
                      {t('proposals.success.title')}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      {t('proposals.success.description', { email: 'mariencarolyn2013@gmail.com' })}
                    </p>
                  </div>
                )}

                {submitError && (
                  <div className="text-center p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-destructive font-semibold mb-2">{t('common.error')}</p>
                    <p className="text-sm text-destructive/80">{submitError}</p>
                    <Button
                      onClick={() => handleSelectProposal(selectedProposal!)}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      {t('proposals.tryAgain')}
                    </Button>
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
