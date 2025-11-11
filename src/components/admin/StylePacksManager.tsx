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
import { Plus, Pencil, Trash2, Loader2, ChevronRight, FolderOpen, Sparkles } from "lucide-react";
import { StylePackEditor } from "./stylepack-editor/StylePackEditor";
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
  const [enhancedEditorOpen, setEnhancedEditorOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<StylePack | null>(null);
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
    parent_id: "",
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

  const handleOpenEnhancedEditor = (pack?: StylePack) => {
    setEditingPack(pack || null);
    setEnhancedEditorOpen(true);
  };

  const handleOpenDialog = (pack?: StylePack, isCategory = false) => {
    setIsCreatingCategory(isCategory);
    if (pack) {
      setSelectedPack(pack);
      const isLevel1 = pack.parent_id === null;
      setFormData({
        name: pack.name,
        description: pack.description || "",
        images: pack.images?.join(", ") || "",
        lora_ref: isLevel1 ? "" : (pack.lora_ref || ""),
        shape_template: isLevel1 ? "" : (pack.shape_template || ""),
        allowed_accents: isLevel1 ? "" : (pack.allowed_accents?.join(", ") || ""),
        banned_terms: isLevel1 ? "" : (pack.banned_terms?.join(", ") || ""),
        palette_range: isLevel1 ? "{}" : JSON.stringify(pack.palette_range || {}),
        is_active: pack.is_active,
        parent_id: pack.parent_id || "",
      });
    } else {
      setSelectedPack(null);
      setFormData({
        name: "",
        description: "",
        images: "",
        lora_ref: "cake_design_v2:0.75",
        shape_template: "round, tiered, square, heart, custom",
        allowed_accents: "gold, silver, rose gold, pearl white, champagne, blush pink",
        banned_terms: "",
        palette_range: JSON.stringify({
          primary: ["#FFFFFF", "#FFF5F5", "#FFF0F0"],
          accent: ["#FFD700", "#C0C0C0", "#F4C2C2"],
          neutral: ["#F5F5DC", "#FFFACD", "#FFF8DC"]
        }, null, 2),
        is_active: true,
        parent_id: currentCategory?.id || "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const isLevel1 = !formData.parent_id;
      const baseData = {
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active,
      };

      let data;
      if (isLevel1) {
        // Level 1 category - basic fields + images
        data = {
          ...baseData,
          is_category: true,
          parent_id: null,
          images: formData.images.split(",").map((s) => s.trim()).filter(Boolean),
        };
      } else {
        // Level 2 style pack - all fields
        data = {
          ...baseData,
          is_category: false,
          parent_id: formData.parent_id,
          images: formData.images.split(",").map((s) => s.trim()).filter(Boolean),
          lora_ref: formData.lora_ref || null,
          shape_template: formData.shape_template || null,
          allowed_accents: formData.allowed_accents.split(",").map((s) => s.trim()).filter(Boolean),
          banned_terms: formData.banned_terms.split(",").map((s) => s.trim()).filter(Boolean),
          palette_range: JSON.parse(formData.palette_range || "{}"),
        };
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
                    {currentCategory && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEnhancedEditor(item);
                        }}
                        title="Enhanced Editor"
                      >
                        <Sparkles className="h-4 w-4 text-primary" />
                      </Button>
                    )}
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

            {/* Only show style pack fields for level 2 (when parent_id exists) */}
            {((selectedPack && selectedPack.parent_id !== null) || (!selectedPack && currentCategory)) && (
              <>
                <div>
                  <Label htmlFor="parent_id">{t("admin.stylePacksManager.dialog.category")}</Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, parent_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("admin.stylePacksManager.dialog.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="shape_template">
                    {t("admin.stylePacksManager.dialog.shapeTemplate")} *
                  </Label>
                  <Textarea
                    id="shape_template"
                    value={formData.shape_template}
                    onChange={(e) =>
                      setFormData({ ...formData, shape_template: e.target.value })
                    }
                    placeholder="케이크 형태 템플릿 (예: round, tiered, square, heart, custom)&#10;- round: 원형 케이크 (1-3단)&#10;- tiered: 다단 케이크 (웨딩용 권장)&#10;- square: 사각형 케이크 (모던 스타일)&#10;- heart: 하트형 (로맨틱 스타일)&#10;- custom: 맞춤형 디자인"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="lora_ref">{t("admin.stylePacksManager.dialog.loraRef")}</Label>
                  <Textarea
                    id="lora_ref"
                    value={formData.lora_ref}
                    onChange={(e) =>
                      setFormData({ ...formData, lora_ref: e.target.value })
                    }
                    placeholder="AI 모델 가중치 설정 (형식: 모델명:가중치)&#10;예: cake_design_v2:0.75&#10;&#10;가중치 범위: 0.5 ~ 1.0&#10;- 0.5-0.6: 약한 스타일 적용 (자연스러움 우선)&#10;- 0.7-0.8: 균형잡힌 스타일 (권장)&#10;- 0.9-1.0: 강한 스타일 적용 (특징 강조)&#10;&#10;케이크 디자인 권장값: 0.75"
                    rows={5}
                  />
                </div>

                <div>
                  <Label htmlFor="allowed_accents">
                    {t("admin.stylePacksManager.dialog.allowedAccents")}
                  </Label>
                  <Textarea
                    id="allowed_accents"
                    value={formData.allowed_accents}
                    onChange={(e) =>
                      setFormData({ ...formData, allowed_accents: e.target.value })
                    }
                    placeholder="허용된 장식 요소 (쉼표로 구분)&#10;예: gold, silver, rose gold, pearl white, champagne, blush pink&#10;&#10;케이크 장식 권장 요소:&#10;- 금속: gold, silver, rose gold, bronze&#10;- 진주: pearl white, pearl ivory, pearl cream&#10;- 파스텔: blush pink, mint, lavender, champagne&#10;- 장식: flowers, ribbons, lace, crystals, berries"
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="banned_terms">
                    {t("admin.stylePacksManager.dialog.bannedTerms")}
                  </Label>
                  <Textarea
                    id="banned_terms"
                    value={formData.banned_terms}
                    onChange={(e) =>
                      setFormData({ ...formData, banned_terms: e.target.value })
                    }
                    placeholder="금지된 용어 (쉼표로 구분)&#10;예: cartoon, anime, unrealistic, toy, plastic&#10;&#10;케이크 디자인에서 제외할 요소:&#10;- 스타일: cartoon, anime, sketch, abstract&#10;- 재질: plastic, toy, fake, artificial&#10;- 품질: blurry, low quality, distorted&#10;- 기타: text, watermark, logo"
                    rows={4}
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
                    placeholder='색상 팔레트 범위 (JSON 형식)&#10;예시:&#10;{&#10;  "primary": ["#FFFFFF", "#FFF5F5", "#FFF0F0"],&#10;  "accent": ["#FFD700", "#C0C0C0", "#F4C2C2"],&#10;  "neutral": ["#F5F5DC", "#FFFACD", "#FFF8DC"]&#10;}&#10;&#10;- primary: 케이크 기본 색상 (아이보리, 화이트 계열)&#10;- accent: 장식 포인트 색상 (골드, 실버, 파스텔)&#10;- neutral: 배경 및 보조 색상&#10;&#10;권장 조합:&#10;웨딩: 화이트 + 골드&#10;로맨틱: 블러쉬 핑크 + 로즈골드&#10;모던: 그레이 + 실버'
                    rows={8}
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

      <StylePackEditor
        open={enhancedEditorOpen}
        onOpenChange={setEnhancedEditorOpen}
        stylePack={editingPack}
        onSave={async (data) => {
          try {
            if (editingPack) {
              const { error } = await supabase
                .from("stylepacks")
                .update(data)
                .eq("id", editingPack.id);

              if (error) throw error;
              toast({ title: t("admin.stylePacksManager.toast.updateSuccess") });
            } else {
              const { error } = await supabase.from("stylepacks").insert([{
                ...data,
                parent_id: currentCategory?.id || null,
                is_category: false,
              }]);

              if (error) throw error;
              toast({ title: t("admin.stylePacksManager.toast.createSuccess") });
            }

            setEnhancedEditorOpen(false);
            fetchData();
          } catch (error) {
            toast({
              title: t("admin.stylePacksManager.toast.saveError"),
              description: error instanceof Error ? error.message : t("admin.toast.errorOccurred"),
              variant: "destructive",
            });
          }
        }}
      />

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
