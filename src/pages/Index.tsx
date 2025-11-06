// =============================================================================
// Home Page - Landing and Overview
// Technical Building Block: P01 - Embed Landing / Stepper Entry Point
// =============================================================================

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Timer, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import heroImage from "@/assets/hero-cake.jpg";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 py-32">
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <Badge variant="default" className="mb-8 text-sm px-4 py-2 rounded-full">
            {t('home.badge')}
          </Badge>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 italic tracking-tight">
            {t('home.title')}
          </h1>
          <p className="text-xl md:text-2xl mb-12 text-foreground/80 max-w-2xl mx-auto font-medium">
            {t('home.subtitle')}
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/design/size")}
            className="text-lg px-12 py-6 h-auto rounded-full font-bold"
          >
            {t('home.cta')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <section className="py-32 px-6 bg-card">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-black text-center mb-20 italic">
            {t('home.features.title')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:shadow-elegant transition-all duration-300">
              <CardHeader className="text-center">
                <Sparkles className="h-16 w-16 mb-6 text-primary mx-auto" />
                <CardTitle className="text-2xl mb-4">{t('home.features.ai.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('home.features.ai.description')}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-2 hover:shadow-elegant transition-all duration-300">
              <CardHeader className="text-center">
                <Layers className="h-16 w-16 mb-6 text-primary mx-auto" />
                <CardTitle className="text-2xl mb-4">{t('home.features.proposals.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('home.features.proposals.description')}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-2 hover:shadow-elegant transition-all duration-300">
              <CardHeader className="text-center">
                <Timer className="h-16 w-16 mb-6 text-primary mx-auto" />
                <CardTitle className="text-2xl mb-4">{t('home.features.fast.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('home.features.fast.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-32 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-black text-center mb-20 italic">{t('home.how.title')}</h2>
          <div className="space-y-6">
            {[1, 2, 3, 4].map((step) => (
              <Card key={step} className="border-2 hover:border-primary transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start gap-6">
                    <Badge className="text-xl px-5 py-2 rounded-full font-black">{step}</Badge>
                    <div className="flex-1">
                      <CardTitle className="mb-3 text-2xl font-black">{t(`home.how.step${step}.title`)}</CardTitle>
                      <CardDescription className="text-base">
                        {t(`home.how.step${step}.description`)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
