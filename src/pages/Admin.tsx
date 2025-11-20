import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, ArrowLeft } from "lucide-react";
import { StylePacksManager } from "@/components/admin/StylePacksManager";
import { SizeCategoriesManager } from "@/components/admin/SizeCategoriesManager";
import { RealityRulesManager } from "@/components/admin/RealityRulesManager";
import TrendsManager from "@/components/admin/TrendsManager";
import { TrendsManagerTabs } from "@/components/admin/TrendsManagerTabs";
import { DataMigration } from "@/components/admin/DataMigration";

type AdminView = "dashboard" | "stylepacks" | "sizes" | "rules" | "requests" | "admins" | "deposit" | "trends" | "migration";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<AdminView>("dashboard");

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: t("admin.toast.signOutSuccess"),
      });
      navigate('/auth');
    } catch (error) {
      toast({
        title: t("admin.toast.signOutError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  if (currentView !== "dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center">
            <Button onClick={() => setCurrentView("dashboard")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("admin.backToDashboard")}
            </Button>
          </div>

          {currentView === "stylepacks" && <StylePacksManager />}
          {currentView === "sizes" && <SizeCategoriesManager />}
          {currentView === "rules" && <RealityRulesManager />}
          {currentView === "trends" && (
            <div className="space-y-6">
              <TrendsManagerTabs />
            </div>
          )}
          {currentView === "migration" && <DataMigration />}
        </div>
        
        <Button 
          onClick={handleSignOut} 
          variant="outline"
          className="fixed bottom-8 right-8 z-50 shadow-lg"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t("admin.signOut")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold">{t("admin.title")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("admin.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView("stylepacks")}>
            <CardHeader>
              <CardTitle>{t("admin.stylePacks.title")}</CardTitle>
              <CardDescription>
                {t("admin.stylePacks.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                {t("admin.manage")}
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView("sizes")}>
            <CardHeader>
              <CardTitle>{t("admin.sizeCategories.title")}</CardTitle>
              <CardDescription>
                {t("admin.sizeCategories.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                {t("admin.manage")}
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView("trends")}>
            <CardHeader>
              <CardTitle>Trend Keywords</CardTitle>
              <CardDescription>
                Manage trend categories and keywords for design generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                {t("admin.manage")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.depositSettings.title")}</CardTitle>
              <CardDescription>
                {t("admin.depositSettings.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary" disabled>
                {t("admin.comingSoon")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.customerRequests.title")}</CardTitle>
              <CardDescription>
                {t("admin.customerRequests.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary" disabled>
                {t("admin.comingSoon")}
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView("rules")}>
            <CardHeader>
              <CardTitle>{t("admin.realityRules.title")}</CardTitle>
              <CardDescription>
                {t("admin.realityRules.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                {t("admin.manage")}
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setCurrentView("migration")}>
            <CardHeader>
              <CardTitle>Data Migration</CardTitle>
              <CardDescription>
                Export and import data to another Supabase project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                {t("admin.manage")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.adminUsers.title")}</CardTitle>
              <CardDescription>
                {t("admin.adminUsers.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary" disabled>
                {t("admin.comingSoon")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Button 
        onClick={handleSignOut} 
        variant="outline"
        className="fixed bottom-8 right-8 z-50 shadow-lg"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {t("admin.signOut")}
      </Button>
    </div>
  );
};

export default Admin;
