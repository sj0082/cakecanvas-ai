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
    <div className="min-h-screen">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${heroImage})`
          }}
        />
        <div className="relative z-10 text-center text-white px-6 max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6 text-lg">
            {t('home.badge')}
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            {t('home.title')}
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            {t('home.subtitle')}
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/design/size")}
            className="text-lg px-8 py-6"
          >
            {t('home.cta')}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <section className="py-20 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            {t('home.features.title')}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Sparkles className="h-12 w-12 mb-4 text-primary" />
                <CardTitle>{t('home.features.ai.title')}</CardTitle>
                <CardDescription>
                  {t('home.features.ai.description')}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Layers className="h-12 w-12 mb-4 text-primary" />
                <CardTitle>{t('home.features.proposals.title')}</CardTitle>
                <CardDescription>
                  {t('home.features.proposals.description')}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Timer className="h-12 w-12 mb-4 text-primary" />
                <CardTitle>{t('home.features.fast.title')}</CardTitle>
                <CardDescription>
                  {t('home.features.fast.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">{t('home.how.title')}</h2>
          <div className="space-y-8">
            {[1, 2, 3, 4].map((step) => (
              <Card key={step}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Badge className="text-lg">{step}</Badge>
                    <div>
                      <CardTitle className="mb-2">{t(`home.how.step${step}.title`)}</CardTitle>
                      <CardDescription>
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
