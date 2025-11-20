import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendImageUpload } from "./TrendImageUpload";
import { TrendImageApproval } from "./TrendImageApproval";
import TrendsManager from "./TrendsManager";

export const TrendsManagerTabs = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="keywords" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keywords">Trend Keywords</TabsTrigger>
          <TabsTrigger value="upload">Upload Images</TabsTrigger>
          <TabsTrigger value="approval">Approve Images</TabsTrigger>
        </TabsList>
        
        <TabsContent value="keywords" className="mt-6">
          <TrendsManager />
        </TabsContent>
        
        <TabsContent value="upload" className="mt-6">
          <TrendImageUpload />
        </TabsContent>
        
        <TabsContent value="approval" className="mt-6">
          <TrendImageApproval />
        </TabsContent>
      </Tabs>
    </div>
  );
};
