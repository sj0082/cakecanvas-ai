// =============================================================================
// Home Page - Landing and Overview
// Technical Building Block: P01 - Embed Landing / Stepper Entry Point
// =============================================================================

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <>
      {/* Fixed Black Frame */}
      <div className="fixed-frame">
        {/* Fixed Navigation Bar - Outside scrolling content */}
        <nav className="absolute top-6 left-0 right-0 z-50 flex items-center justify-between px-10 md:px-12">
          <div className="flex items-center gap-2 border-2 border-background rounded-full px-4 py-2 bg-black">
            <span className="text-background font-black text-xl">🎂</span>
          </div>
          <div className="flex items-center gap-6">
            <LanguageSelector />
          </div>
        </nav>

        {/* Scrolling Content Inside Fixed Frame */}
        <div className="scrolling-content">
          {/* Hero Section */}
          <section className="min-h-screen flex items-center justify-center overflow-hidden relative px-6 py-32">
            <div className="absolute inset-0 opacity-20">
              <img src={heroImage} alt="Hero" className="w-full h-full object-cover" />
            </div>
            <div className="relative z-10 text-center max-w-5xl mx-auto">
              <Badge variant="secondary" className="mb-8 text-sm px-4 py-2">
                {t('home.badge')}
              </Badge>
              <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-8 italic tracking-tight leading-none">
                {t('home.title')}
              </h1>
              <p className="text-xl md:text-2xl mb-12 text-foreground/70 max-w-2xl mx-auto font-medium">
                {t('home.subtitle')}
              </p>
              <Button
                size="lg"
                onClick={() => navigate("/design/size")}
                className="text-lg px-12 py-7 h-auto font-bold shadow-elegant hover:scale-105 transition-transform"
              >
                {t('home.cta')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </section>

          {/* Features Section */}
          <section className="min-h-screen py-20 px-6 md:px-12 bg-card">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-center mb-16 italic">
                {t('home.features.title')}
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-primary rounded-3xl p-8 text-primary-foreground hover:scale-105 transition-transform">
                  <Sparkles className="h-16 w-16 mb-6" />
                  <h3 className="text-3xl font-black mb-4">{t('home.features.ai.title')}</h3>
                  <p className="text-lg opacity-90">
                    {t('home.features.ai.description')}
                  </p>
                </div>
                <div className="bg-accent rounded-3xl p-8 text-accent-foreground hover:scale-105 transition-transform">
                  <Layers className="h-16 w-16 mb-6" />
                  <h3 className="text-3xl font-black mb-4">{t('home.features.proposals.title')}</h3>
                  <p className="text-lg opacity-90">
                    {t('home.features.proposals.description')}
                  </p>
                </div>
                <div className="bg-secondary rounded-3xl p-8 hover:scale-105 transition-transform">
                  <Timer className="h-16 w-16 mb-6 text-foreground" />
                  <h3 className="text-3xl font-black mb-4">{t('home.features.fast.title')}</h3>
                  <p className="text-lg text-foreground/70">
                    {t('home.features.fast.description')}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="min-h-screen py-20 px-6 md:px-12">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-center mb-16 italic">
                {t('home.how.title')}
              </h2>
              <div className="space-y-6 pb-20">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step} 
                    className="bg-card border-2 border-border rounded-3xl p-8 hover:border-primary transition-all hover:shadow-elegant"
                  >
                    <div className="flex items-start gap-6">
                      <Badge className="text-2xl px-6 py-3 font-black shrink-0">{step}</Badge>
                      <div className="flex-1">
                        <h3 className="mb-3 text-3xl font-black">{t(`home.how.step${step}.title`)}</h3>
                        <p className="text-lg text-muted-foreground">
                          {t(`home.how.step${step}.description`)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default Index;
