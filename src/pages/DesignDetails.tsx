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
import { ArrowLeft, Sparkles, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DesignStepper } from "@/components/design/DesignStepper";


const DesignDetails = () => {
  const [userText, setUserText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  const sizeId = searchParams.get("size");
  const styleId = searchParams.get("style");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newImageUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({ 
            title: t('common.error'), 
            description: `${file.name} is not an image file`, 
            variant: "destructive" 
          });
          continue;
        }

        // Validate file size (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast({ 
            title: t('common.error'), 
            description: `${file.name} is too large (max 10MB)`, 
            variant: "destructive" 
          });
          continue;
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
        const filePath = `inspiration/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('cake-inspiration')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({ 
            title: t('common.error'), 
            description: `Failed to upload ${file.name}`, 
            variant: "destructive" 
          });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('cake-inspiration')
          .getPublicUrl(filePath);

        newImageUrls.push(publicUrl);
      }

      if (newImageUrls.length > 0) {
        setUploadedImages([...uploadedImages, ...newImageUrls]);
        toast({ 
          title: t('common.success'), 
          description: `${newImageUrls.length} image(s) uploaded successfully` 
        });
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({ 
        title: t('common.error'), 
        description: 'Failed to upload images', 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    setUploadedImages(uploadedImages.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if (!sizeId || !styleId || !contactEmail) {
      toast({ title: t('common.error'), description: t(!contactEmail ? 'details.error.missingEmail' : 'details.error.missingParams'), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-request', {
        body: {
          size_category_id: sizeId,
          stylepack_id: styleId,
          user_text: userText || null,
          user_images: uploadedImages.length > 0 ? uploadedImages : null,
          contact_email: contactEmail,
          contact_phone: contactPhone || null,
          status: "GENERATING"
        }
      });

      if (error) throw error;
      if (!data || !data.id || !data.access_token) {
        throw new Error('Invalid response from server');
      }

      toast({ title: t('common.success'), description: t('details.success.description') });
      navigate(`/design/proposals/${data.id}?token=${data.access_token}`);
    } catch (error) {
      console.error('Error creating request:', error);
      toast({ title: t('common.error'), description: t('details.error.failed'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed-frame">
      
      <div className="scrolling-content">
        <div className="min-h-full py-12 px-6">
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

                <div className="space-y-2">
                  <Label>Inspiration Images</Label>
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors">
                    <input
                      type="file"
                      id="image-upload"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium mb-1">
                        {uploading ? 'Uploading...' : 'Upload cake inspiration images'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, WEBP up to 10MB each
                      </p>
                    </label>
                  </div>

                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      {uploadedImages.map((url, index) => (
                        <div key={index} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
                          <img
                            src={url}
                            alt={`Inspiration ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
      </div>
    </div>
  );
};

export default DesignDetails;
