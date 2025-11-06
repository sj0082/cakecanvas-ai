// =============================================================================
// Design Details Page  
// Technical Building Block: P01 - Detail Input Form + P03 - Multi-uploader
// =============================================================================

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DesignStepper } from "@/components/design/DesignStepper";
import { LanguageSelector } from "@/components/LanguageSelector";

const DesignDetails = () => {
  const [userText, setUserText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const sizeId = searchParams.get("size");
  const styleId = searchParams.get("style");

  const handleSubmit = async () => {
    if (!sizeId || !styleId || !contactEmail) {
      toast({ title: t('common.error'), description: t(!contactEmail ? 'details.error.missingEmail' : 'details.error.missingParams'), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from("requests").insert({
        size_category_id: sizeId, stylepack_id: styleId, user_text: userText || null,
        contact_email: contactEmail, contact_phone: contactPhone || null, status: "GENERATING"
      }).select().single();

      if (error) throw error;
      toast({ title: t('common.success'), description: t('details.success.description') });
      navigate(`/design/proposals/${data.id}`);
    } catch (error) {
      toast({ title: t('common.error'), description: t('details.error.failed'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="fixed top-4 right-4 z-50"><LanguageSelector /></div>
      <div className="max-w-4xl mx-auto">
        <DesignStepper />
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">{t('details.badge')}</Badge>
          <h1 className="text-4xl font-bold mb-4">{t('details.title')}</h1>
          <p className="text-xl text-muted-foreground">{t('details.subtitle')}</p>
        </div>
        <Card className="mb-8">
          <CardHeader><CardTitle>{t('details.design.title')}</CardTitle><CardDescription>{t('details.design.description')}</CardDescription></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="user-text">{t('details.design.label')}</Label>
              <Textarea id="user-text" placeholder={t('details.design.placeholder')} value={userText} onChange={(e) => setUserText(e.target.value)} rows={5} />
              <p className="text-sm text-muted-foreground">{t('details.design.help')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="mb-8">
          <CardHeader><CardTitle>{t('details.contact.title')}</CardTitle><CardDescription>{t('details.contact.description')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('details.contact.email.label')} *</Label>
              <Input id="email" type="email" placeholder={t('details.contact.email.placeholder')} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('details.contact.phone.label')}</Label>
              <Input id="phone" type="tel" placeholder={t('details.contact.phone.placeholder')} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate(`/design/style?size=${sizeId}`)} disabled={loading} className="px-8">
            <ArrowLeft className="mr-2 h-5 w-5" />{t('details.prev')}
          </Button>
          <Button size="lg" onClick={handleSubmit} disabled={loading || !contactEmail} className="px-8">
            {loading ? t('details.submitting') : <>{t('details.submit')}<Sparkles className="ml-2 h-5 w-5" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DesignDetails;
