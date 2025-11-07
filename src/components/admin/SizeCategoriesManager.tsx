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

interface SizeCategory {
  id: string;
  code: string;
  name: string;
  serving_min: number;
  serving_max: number;
  base_price_min: number;
  base_price_max: number;
  lead_time_days: number;
  delivery_radius_miles: number | null;
  tiers_spec: any;
  is_active: boolean;
}

export const SizeCategoriesManager = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<SizeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SizeCategory | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    serving_min: "",
    serving_max: "",
    base_price_min: "",
    base_price_max: "",
    lead_time_days: "",
    delivery_radius_miles: "",
    tiers_spec: "{}",
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("size_categories")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      toast({
        title: t("admin.sizeCategoriesManager.toast.fetchError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category?: SizeCategory) => {
    if (category) {
      setSelectedCategory(category);
      setFormData({
        code: category.code,
        name: category.name,
        serving_min: category.serving_min.toString(),
        serving_max: category.serving_max.toString(),
        base_price_min: category.base_price_min.toString(),
        base_price_max: category.base_price_max.toString(),
        lead_time_days: category.lead_time_days.toString(),
        delivery_radius_miles: category.delivery_radius_miles?.toString() || "",
        tiers_spec: JSON.stringify(category.tiers_spec),
        is_active: category.is_active,
      });
    } else {
      setSelectedCategory(null);
      setFormData({
        code: "",
        name: "",
        serving_min: "",
        serving_max: "",
        base_price_min: "",
        base_price_max: "",
        lead_time_days: "",
        delivery_radius_miles: "",
        tiers_spec: "{}",
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        code: formData.code,
        name: formData.name,
        serving_min: parseInt(formData.serving_min),
        serving_max: parseInt(formData.serving_max),
        base_price_min: parseFloat(formData.base_price_min),
        base_price_max: parseFloat(formData.base_price_max),
        lead_time_days: parseInt(formData.lead_time_days),
        delivery_radius_miles: formData.delivery_radius_miles
          ? parseInt(formData.delivery_radius_miles)
          : null,
        tiers_spec: JSON.parse(formData.tiers_spec),
        is_active: formData.is_active,
      };

      if (selectedCategory) {
        const { error } = await supabase
          .from("size_categories")
          .update(data)
          .eq("id", selectedCategory.id);

        if (error) throw error;
        toast({ title: t("admin.sizeCategoriesManager.toast.updateSuccess") });
      } else {
        const { error } = await supabase.from("size_categories").insert([data]);

        if (error) throw error;
        toast({ title: t("admin.sizeCategoriesManager.toast.createSuccess") });
      }

      setDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast({
        title: t("admin.sizeCategoriesManager.toast.saveError"),
        description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from("size_categories")
        .delete()
        .eq("id", selectedCategory.id);

      if (error) throw error;

      toast({ title: t("admin.sizeCategoriesManager.toast.deleteSuccess") });
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast({
        title: t("admin.sizeCategoriesManager.toast.deleteError"),
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
        <h2 className="text-2xl font-bold">{t("admin.sizeCategoriesManager.title")}</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.sizeCategoriesManager.addButton")}
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.sizeCategoriesManager.table.code")}</TableHead>
              <TableHead>{t("admin.sizeCategoriesManager.table.name")}</TableHead>
              <TableHead>{t("admin.sizeCategoriesManager.table.servings")}</TableHead>
              <TableHead>{t("admin.sizeCategoriesManager.table.priceRange")}</TableHead>
              <TableHead>{t("admin.sizeCategoriesManager.table.leadTime")}</TableHead>
              <TableHead>{t("admin.sizeCategoriesManager.table.active")}</TableHead>
              <TableHead className="text-right">{t("admin.sizeCategoriesManager.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.code}</TableCell>
                <TableCell>{category.name}</TableCell>
                <TableCell>
                  {category.serving_min}-{category.serving_max}
                </TableCell>
                <TableCell>
                  ${category.base_price_min}-${category.base_price_max}
                </TableCell>
                <TableCell>{category.lead_time_days} {t("admin.sizeCategoriesManager.table.days")}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      category.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {category.is_active ? t("admin.sizeCategoriesManager.table.activeStatus") : t("admin.sizeCategoriesManager.table.inactiveStatus")}
                  </span>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(category)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedCategory(category);
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
              {selectedCategory ? t("admin.sizeCategoriesManager.dialog.editTitle") : t("admin.sizeCategoriesManager.dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedCategory
                ? t("admin.sizeCategoriesManager.dialog.editDescription")
                : t("admin.sizeCategoriesManager.dialog.addDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">{t("admin.sizeCategoriesManager.dialog.code")} *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="name">{t("admin.sizeCategoriesManager.dialog.name")} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serving_min">{t("admin.sizeCategoriesManager.dialog.minServings")} *</Label>
                <Input
                  id="serving_min"
                  type="number"
                  value={formData.serving_min}
                  onChange={(e) =>
                    setFormData({ ...formData, serving_min: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="serving_max">{t("admin.sizeCategoriesManager.dialog.maxServings")} *</Label>
                <Input
                  id="serving_max"
                  type="number"
                  value={formData.serving_max}
                  onChange={(e) =>
                    setFormData({ ...formData, serving_max: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base_price_min">{t("admin.sizeCategoriesManager.dialog.minPrice")} *</Label>
                <Input
                  id="base_price_min"
                  type="number"
                  step="0.01"
                  value={formData.base_price_min}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price_min: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="base_price_max">{t("admin.sizeCategoriesManager.dialog.maxPrice")} *</Label>
                <Input
                  id="base_price_max"
                  type="number"
                  step="0.01"
                  value={formData.base_price_max}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price_max: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lead_time_days">{t("admin.sizeCategoriesManager.dialog.leadTime")} *</Label>
                <Input
                  id="lead_time_days"
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) =>
                    setFormData({ ...formData, lead_time_days: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="delivery_radius_miles">{t("admin.sizeCategoriesManager.dialog.deliveryRadius")}</Label>
                <Input
                  id="delivery_radius_miles"
                  type="number"
                  value={formData.delivery_radius_miles}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_radius_miles: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tiers_spec">{t("admin.sizeCategoriesManager.dialog.tiersSpec")}</Label>
              <Textarea
                id="tiers_spec"
                value={formData.tiers_spec}
                onChange={(e) =>
                  setFormData({ ...formData, tiers_spec: e.target.value })
                }
                placeholder={t("admin.sizeCategoriesManager.dialog.tiersSpecPlaceholder")}
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
              <Label htmlFor="is_active">{t("admin.sizeCategoriesManager.dialog.active")}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("admin.sizeCategoriesManager.dialog.cancel")}
            </Button>
            <Button onClick={handleSave}>{t("admin.sizeCategoriesManager.dialog.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.sizeCategoriesManager.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.sizeCategoriesManager.deleteDialog.description", { name: selectedCategory?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.sizeCategoriesManager.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("admin.sizeCategoriesManager.deleteDialog.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
