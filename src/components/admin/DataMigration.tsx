import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export const DataMigration = () => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [skipExisting, setSkipExisting] = useState(true);
  const [exportedData, setExportedData] = useState<any>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-all-data');

      if (error) throw error;

      setExportedData(data);

      // JSON 파일로 다운로드
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lovable-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "✅ Export 완료",
        description: `${data.metadata.totalTables}개 테이블의 데이터를 성공적으로 Export했습니다.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "❌ Export 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!targetUrl || !targetKey) {
      toast({
        title: "⚠️ 입력 필요",
        description: "타겟 Supabase URL과 Service Role Key를 입력하세요.",
        variant: "destructive",
      });
      return;
    }

    if (!exportedData) {
      toast({
        title: "⚠️ Export 필요",
        description: "먼저 데이터를 Export 해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-data', {
        body: {
          targetUrl,
          targetKey,
          exportData: exportedData,
          skipExisting,
        },
      });

      if (error) throw error;

      toast({
        title: "✅ Import 완료",
        description: `${data.summary.successful}개 테이블 성공, ${data.summary.failed}개 실패, ${data.summary.skipped}개 스킵`,
      });

      console.log('Import results:', data.results);
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "❌ Import 실패",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setExportedData(json);
        toast({
          title: "✅ 파일 로드 완료",
          description: `${json.metadata?.totalTables || 0}개 테이블 데이터를 로드했습니다.`,
        });
      } catch (error) {
        toast({
          title: "❌ 파일 읽기 실패",
          description: "올바른 JSON 파일이 아닙니다.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Export 현재 데이터</CardTitle>
          <CardDescription>
            현재 Lovable Cloud 프로젝트의 모든 데이터를 JSON 파일로 Export합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export All Data
              </>
            )}
          </Button>
          {exportedData && (
            <p className="mt-2 text-sm text-muted-foreground">
              ✅ {exportedData.metadata.totalTables}개 테이블 Export 완료
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Import 타겟 설정</CardTitle>
          <CardDescription>
            데이터를 Import할 개인 Supabase 프로젝트 정보를 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="targetUrl">Supabase URL</Label>
            <Input
              id="targetUrl"
              placeholder="https://your-project.supabase.co"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetKey">Service Role Key</Label>
            <Input
              id="targetKey"
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={targetKey}
              onChange={(e) => setTargetKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ Service Role Key는 RLS를 우회하므로 절대 공유하지 마세요.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="skipExisting"
              checked={skipExisting}
              onCheckedChange={(checked) => setSkipExisting(checked as boolean)}
            />
            <Label
              htmlFor="skipExisting"
              className="text-sm font-normal cursor-pointer"
            >
              중복된 ID는 건너뛰기 (upsert 모드)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileUpload">또는 Export 파일 업로드</Label>
            <Input
              id="fileUpload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Import 실행</CardTitle>
          <CardDescription>
            Export한 데이터를 타겟 Supabase 프로젝트로 Import합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleImport}
            disabled={isImporting || !exportedData || !targetUrl || !targetKey}
            className="w-full"
            variant="default"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import to Target Supabase
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <CardHeader>
          <CardTitle className="text-yellow-800 dark:text-yellow-200">⚠️ 주의사항</CardTitle>
        </CardHeader>
        <CardContent className="text-yellow-700 dark:text-yellow-300 text-sm space-y-2">
          <p>• 타겟 Supabase 프로젝트에 동일한 스키마가 먼저 생성되어 있어야 합니다.</p>
          <p>• Service Role Key는 절대 공유하거나 커밋하지 마세요.</p>
          <p>• 대량의 데이터는 시간이 걸릴 수 있습니다.</p>
          <p>• 외래 키 제약조건을 확인하세요. 테이블 순서가 중요합니다.</p>
          <p>• Import 전에 반드시 타겟 데이터베이스를 백업하세요.</p>
        </CardContent>
      </Card>
    </div>
  );
};
