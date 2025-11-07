import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface RealityRule {
  id: string;
  key: string;
  message: string;
  severity: string;
  threshold_value: string | null;
  is_active: boolean;
}

export const RealityRulesManager = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<RealityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RealityRule | null>(null);
  const [formData, setFormData] = useState({
    key: "",
    message: "",
    severity: "warning",
    threshold_value: "",
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from("rules_reality")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      toast({
        title: t("admin.realityRulesManager.toast.fetchError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule?: RealityRule) => {
    if (rule) {
      setSelectedRule(rule);
      setFormData({
        key: rule.key,
        message: rule.message,
        severity: rule.severity,
        threshold_value: rule.threshold_value || "",
        is_active: rule.is_active,
      });
    } else {
      setSelectedRule(null);
      setFormData({
        key: "",
        message: "",
        severity: "warning",
        threshold_value: "",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        key: formData.key,
        message: formData.message,
        severity: formData.severity,
        threshold_value: formData.threshold_value || null,
        is_active: formData.is_active,
      };

      if (selectedRule) {
        const { error } = await supabase
          .from("rules_reality")
          .update(data)
          .eq("id", selectedRule.id);

        if (error) throw error;
        toast({ title: t("admin.realityRulesManager.toast.updateSuccess") });
      } else {
        const { error } = await supabase.from("rules_reality").insert([data]);

        if (error) throw error;
        toast({ title: t("admin.realityRulesManager.toast.createSuccess") });
      }

      setDialogOpen(false);
      fetchRules();
    } catch (error) {
      toast({
        title: t("admin.realityRulesManager.toast.saveError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedRule) return;

    try {
      const { error } = await supabase
        .from("rules_reality")
        .delete()
        .eq("id", selectedRule.id);

      if (error) throw error;

      toast({ title: t("admin.realityRulesManager.toast.deleteSuccess") });
      setDeleteDialogOpen(false);
      fetchRules();
    } catch (error) {
      toast({
        title: t("admin.realityRulesManager.toast.deleteError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t("admin.realityRulesManager.title")}</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.realityRulesManager.addButton")}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.realityRulesManager.table.key")}</TableHead>
              <TableHead>{t("admin.realityRulesManager.table.message")}</TableHead>
              <TableHead>{t("admin.realityRulesManager.table.severity")}</TableHead>
              <TableHead>{t("admin.realityRulesManager.table.threshold")}</TableHead>
              <TableHead>{t("admin.realityRulesManager.table.active")}</TableHead>
              <TableHead className="text-right">{t("admin.realityRulesManager.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.key}</TableCell>
                <TableCell className="max-w-xs truncate">{rule.message}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      rule.severity === "error"
                        ? "bg-red-100 text-red-800"
                        : rule.severity === "warning"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {rule.severity}
                  </span>
                </TableCell>
                <TableCell>{rule.threshold_value || "-"}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      rule.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {rule.is_active ? t("admin.realityRulesManager.table.activeStatus") : t("admin.realityRulesManager.table.inactiveStatus")}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(rule)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedRule(rule);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRule ? t("admin.realityRulesManager.dialog.editTitle") : t("admin.realityRulesManager.dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedRule
                ? t("admin.realityRulesManager.dialog.editDescription")
                : t("admin.realityRulesManager.dialog.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="key">{t("admin.realityRulesManager.dialog.key")} *</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder={t("admin.realityRulesManager.dialog.keyPlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor="message">{t("admin.realityRulesManager.dialog.message")} *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder={t("admin.realityRulesManager.dialog.messagePlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor="severity">{t("admin.realityRulesManager.dialog.severity")} *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData({ ...formData, severity: value })
                }
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">{t("admin.realityRulesManager.dialog.severityInfo")}</SelectItem>
                  <SelectItem value="warning">{t("admin.realityRulesManager.dialog.severityWarning")}</SelectItem>
                  <SelectItem value="error">{t("admin.realityRulesManager.dialog.severityError")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="threshold_value">{t("admin.realityRulesManager.dialog.thresholdValue")}</Label>
              <Input
                id="threshold_value"
                value={formData.threshold_value}
                onChange={(e) =>
                  setFormData({ ...formData, threshold_value: e.target.value })
                }
                placeholder={t("admin.realityRulesManager.dialog.thresholdPlaceholder")}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">{t("admin.realityRulesManager.dialog.active")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("admin.realityRulesManager.dialog.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("admin.realityRulesManager.dialog.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.realityRulesManager.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.realityRulesManager.deleteDialog.description", { name: selectedRule?.key })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.realityRulesManager.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("admin.realityRulesManager.deleteDialog.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
