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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface StylePack {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  lora_ref: string | null;
  shape_template: string;
  allowed_accents: string[];
  banned_terms: string[];
  palette_range: any;
  is_active: boolean;
}

export const StylePacksManager = () => {
  const { t } = useTranslation();
  const [stylePacks, setStylePacks] = useState<StylePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<StylePack | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    images: "",
    lora_ref: "",
    shape_template: "",
    allowed_accents: "",
    banned_terms: "",
    palette_range: "{}",
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStylePacks();
  }, []);

  const fetchStylePacks = async () => {
    try {
      const { data, error } = await supabase
        .from("stylepacks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStylePacks(data || []);
    } catch (error) {
      toast({
        title: t("admin.stylePacksManager.toast.fetchError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (pack?: StylePack) => {
    if (pack) {
      setSelectedPack(pack);
      setFormData({
        name: pack.name,
        description: pack.description || "",
        images: pack.images.join(", "),
        lora_ref: pack.lora_ref || "",
        shape_template: pack.shape_template,
        allowed_accents: pack.allowed_accents.join(", "),
        banned_terms: pack.banned_terms.join(", "),
        palette_range: JSON.stringify(pack.palette_range),
        is_active: pack.is_active,
      });
    } else {
      setSelectedPack(null);
      setFormData({
        name: "",
        description: "",
        images: "",
        lora_ref: "",
        shape_template: "",
        allowed_accents: "",
        banned_terms: "",
        palette_range: "{}",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        name: formData.name,
        description: formData.description || null,
        images: formData.images.split(",").map((s) => s.trim()).filter(Boolean),
        lora_ref: formData.lora_ref || null,
        shape_template: formData.shape_template,
        allowed_accents: formData.allowed_accents.split(",").map((s) => s.trim()).filter(Boolean),
        banned_terms: formData.banned_terms.split(",").map((s) => s.trim()).filter(Boolean),
        palette_range: JSON.parse(formData.palette_range),
        is_active: formData.is_active,
      };

      if (selectedPack) {
        const { error } = await supabase
          .from("stylepacks")
          .update(data)
          .eq("id", selectedPack.id);

        if (error) throw error;
        toast({ title: t("admin.stylePacksManager.toast.updateSuccess") });
      } else {
        const { error } = await supabase.from("stylepacks").insert([data]);

        if (error) throw error;
        toast({ title: t("admin.stylePacksManager.toast.createSuccess") });
      }

      setDialogOpen(false);
      fetchStylePacks();
    } catch (error) {
      toast({
        title: t("admin.stylePacksManager.toast.saveError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedPack) return;

    try {
      const { error } = await supabase
        .from("stylepacks")
        .delete()
        .eq("id", selectedPack.id);

      if (error) throw error;

      toast({ title: t("admin.stylePacksManager.toast.deleteSuccess") });
      setDeleteDialogOpen(false);
      fetchStylePacks();
    } catch (error) {
      toast({
        title: t("admin.stylePacksManager.toast.deleteError"),
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
        <h2 className="text-2xl font-bold">{t("admin.stylePacksManager.title")}</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.stylePacksManager.addButton")}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.stylePacksManager.table.name")}</TableHead>
              <TableHead>{t("admin.stylePacksManager.table.shapeTemplate")}</TableHead>
              <TableHead>{t("admin.stylePacksManager.table.images")}</TableHead>
              <TableHead>{t("admin.stylePacksManager.table.active")}</TableHead>
              <TableHead className="text-right">{t("admin.stylePacksManager.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stylePacks.map((pack) => (
              <TableRow key={pack.id}>
                <TableCell className="font-medium">{pack.name}</TableCell>
                <TableCell>{pack.shape_template}</TableCell>
                <TableCell>{pack.images.length} {t("admin.stylePacksManager.table.imageCount")}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      pack.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {pack.is_active ? t("admin.stylePacksManager.table.activeStatus") : t("admin.stylePacksManager.table.inactiveStatus")}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(pack)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedPack(pack);
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPack ? t("admin.stylePacksManager.dialog.editTitle") : t("admin.stylePacksManager.dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedPack
                ? t("admin.stylePacksManager.dialog.editDescription")
                : t("admin.stylePacksManager.dialog.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t("admin.stylePacksManager.dialog.name")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">{t("admin.stylePacksManager.dialog.description")}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="images">{t("admin.stylePacksManager.dialog.images")} *</Label>
              <Textarea
                id="images"
                value={formData.images}
                onChange={(e) =>
                  setFormData({ ...formData, images: e.target.value })
                }
                placeholder={t("admin.stylePacksManager.dialog.imagesPlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor="shape_template">{t("admin.stylePacksManager.dialog.shapeTemplate")} *</Label>
              <Input
                id="shape_template"
                value={formData.shape_template}
                onChange={(e) =>
                  setFormData({ ...formData, shape_template: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="lora_ref">{t("admin.stylePacksManager.dialog.loraRef")}</Label>
              <Input
                id="lora_ref"
                value={formData.lora_ref}
                onChange={(e) =>
                  setFormData({ ...formData, lora_ref: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="allowed_accents">{t("admin.stylePacksManager.dialog.allowedAccents")}</Label>
              <Input
                id="allowed_accents"
                value={formData.allowed_accents}
                onChange={(e) =>
                  setFormData({ ...formData, allowed_accents: e.target.value })
                }
                placeholder={t("admin.stylePacksManager.dialog.allowedAccentsPlaceholder")}
              />
            </div>

            <div>
              <Label htmlFor="banned_terms">{t("admin.stylePacksManager.dialog.bannedTerms")}</Label>
              <Input
                id="banned_terms"
                value={formData.banned_terms}
                onChange={(e) =>
                  setFormData({ ...formData, banned_terms: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="palette_range">{t("admin.stylePacksManager.dialog.paletteRange")}</Label>
              <Textarea
                id="palette_range"
                value={formData.palette_range}
                onChange={(e) =>
                  setFormData({ ...formData, palette_range: e.target.value })
                }
                placeholder={t("admin.stylePacksManager.dialog.paletteRangePlaceholder")}
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
              <Label htmlFor="is_active">{t("admin.stylePacksManager.dialog.active")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("admin.stylePacksManager.dialog.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("admin.stylePacksManager.dialog.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.stylePacksManager.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.stylePacksManager.deleteDialog.description", { name: selectedPack?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.stylePacksManager.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("admin.stylePacksManager.deleteDialog.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
