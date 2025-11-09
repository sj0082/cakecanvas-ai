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
import { Plus, Pencil, Trash2, Loader2, ChevronRight, FolderOpen } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface StylePack {
  id: string;
  name: string;
  description: string | null;
  images: string[] | null;
  lora_ref: string | null;
  shape_template: string | null;
  allowed_accents: string[] | null;
  banned_terms: string[] | null;
  palette_range: any;
  is_active: boolean;
  parent_id: string | null;
  is_category: boolean;
}

export const StylePacksManager = () => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<StylePack[]>([]);
  const [currentCategory, setCurrentCategory] = useState<StylePack | null>(null);
  const [stylePacks, setStylePacks] = useState<StylePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
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
    fetchData();
  }, [currentCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!currentCategory) {
        // Fetch categories (parent_id IS NULL)
        const { data, error } = await supabase
          .from("stylepacks")
          .select("*")
          .is("parent_id", null)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCategories(data || []);
        setStylePacks([]);
      } else {
        // Fetch style packs for the selected category
        const { data, error } = await supabase
          .from("stylepacks")
          .select("*")
          .eq("parent_id", currentCategory.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setStylePacks(data || []);
      }
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

  const handleOpenDialog = (pack?: StylePack, isCategory = false) => {
    setIsCreatingCategory(isCategory);
    if (pack) {
      setSelectedPack(pack);
      setFormData({
        name: pack.name,
        description: pack.description || "",
        images: pack.images?.join(", ") || "",
        lora_ref: pack.lora_ref || "",
        shape_template: pack.shape_template || "",
        allowed_accents: pack.allowed_accents?.join(", ") || "",
        banned_terms: pack.banned_terms?.join(", ") || "",
        palette_range: JSON.stringify(pack.palette_range || {}),
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
      const baseData = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
      };

      let data;
      if (isCreatingCategory && !selectedPack) {
        // Creating a new category
        data = {
          ...baseData,
          is_category: true,
          parent_id: null,
        };
      } else if (!isCreatingCategory && !selectedPack) {
        // Creating a new style pack under current category
        data = {
          ...baseData,
          is_category: false,
          parent_id: currentCategory?.id,
          images: formData.images.split(",").map((s) => s.trim()).filter(Boolean),
          lora_ref: formData.lora_ref || null,
          shape_template: formData.shape_template,
          allowed_accents: formData.allowed_accents.split(",").map((s) => s.trim()).filter(Boolean),
          banned_terms: formData.banned_terms.split(",").map((s) => s.trim()).filter(Boolean),
          palette_range: JSON.parse(formData.palette_range),
        };
      } else {
        // Updating existing item
        if (selectedPack?.is_category) {
          data = baseData;
        } else {
          data = {
            ...baseData,
            images: formData.images.split(",").map((s) => s.trim()).filter(Boolean),
            lora_ref: formData.lora_ref || null,
            shape_template: formData.shape_template,
            allowed_accents: formData.allowed_accents.split(",").map((s) => s.trim()).filter(Boolean),
            banned_terms: formData.banned_terms.split(",").map((s) => s.trim()).filter(Boolean),
            palette_range: JSON.parse(formData.palette_range),
          };
        }
      }

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
      fetchData();
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
      fetchData();
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

  const displayItems = currentCategory ? stylePacks : categories;

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => setCurrentCategory(null)}
              className="cursor-pointer"
            >
              {t("admin.stylePacksManager.breadcrumb.categories")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {currentCategory && (
            <>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink className="font-medium">
                  {currentCategory.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {currentCategory
            ? t("admin.stylePacksManager.title.stylePacks")
            : t("admin.stylePacksManager.title.categories")}
        </h2>
        <div className="flex gap-2">
          {!currentCategory && (
            <Button onClick={() => handleOpenDialog(undefined, true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.stylePacksManager.addCategory")}
            </Button>
          )}
          {currentCategory && (
            <Button onClick={() => handleOpenDialog(undefined, false)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.stylePacksManager.addStylePack")}
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.stylePacksManager.table.name")}</TableHead>
              {currentCategory && (
                <>
                  <TableHead>{t("admin.stylePacksManager.table.shapeTemplate")}</TableHead>
                  <TableHead>{t("admin.stylePacksManager.table.images")}</TableHead>
                </>
              )}
              <TableHead>{t("admin.stylePacksManager.table.active")}</TableHead>
              <TableHead className="text-right">{t("admin.stylePacksManager.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={currentCategory ? 5 : 3} className="text-center py-8 text-muted-foreground">
                  {currentCategory
                    ? t("admin.stylePacksManager.table.noStylePacks")
                    : t("admin.stylePacksManager.table.noCategories")}
                </TableCell>
              </TableRow>
            ) : (
              displayItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={!currentCategory ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => !currentCategory && setCurrentCategory(item)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {!currentCategory && <FolderOpen className="h-4 w-4 text-primary" />}
                      {item.name}
                    </div>
                  </TableCell>
                  {currentCategory && (
                    <>
                      <TableCell>{item.shape_template || "-"}</TableCell>
                      <TableCell>
                        {item.images?.length || 0} {t("admin.stylePacksManager.table.imageCount")}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        item.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {item.is_active
                        ? t("admin.stylePacksManager.table.activeStatus")
                        : t("admin.stylePacksManager.table.inactiveStatus")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(item, item.is_category);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPack(item);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPack
                ? isCreatingCategory || selectedPack.is_category
                  ? t("admin.stylePacksManager.dialog.editCategory")
                  : t("admin.stylePacksManager.dialog.editTitle")
                : isCreatingCategory
                ? t("admin.stylePacksManager.dialog.addCategory")
                : t("admin.stylePacksManager.dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedPack
                ? isCreatingCategory || selectedPack.is_category
                  ? t("admin.stylePacksManager.dialog.editCategoryDescription")
                  : t("admin.stylePacksManager.dialog.editDescription")
                : isCreatingCategory
                ? t("admin.stylePacksManager.dialog.addCategoryDescription")
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

            {/* Only show style pack fields when not creating/editing a category */}
            {!isCreatingCategory && !selectedPack?.is_category && (
              <>
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
                  <Label htmlFor="shape_template">
                    {t("admin.stylePacksManager.dialog.shapeTemplate")} *
                  </Label>
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
                  <Label htmlFor="allowed_accents">
                    {t("admin.stylePacksManager.dialog.allowedAccents")}
                  </Label>
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
                  <Label htmlFor="banned_terms">
                    {t("admin.stylePacksManager.dialog.bannedTerms")}
                  </Label>
                  <Input
                    id="banned_terms"
                    value={formData.banned_terms}
                    onChange={(e) =>
                      setFormData({ ...formData, banned_terms: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="palette_range">
                    {t("admin.stylePacksManager.dialog.paletteRange")}
                  </Label>
                  <Textarea
                    id="palette_range"
                    value={formData.palette_range}
                    onChange={(e) =>
                      setFormData({ ...formData, palette_range: e.target.value })
                    }
                    placeholder={t("admin.stylePacksManager.dialog.paletteRangePlaceholder")}
                  />
                </div>
              </>
            )}

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
