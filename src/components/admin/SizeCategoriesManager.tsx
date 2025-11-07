import { useState, useEffect } from "react";
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
        title: "Error fetching size categories",
        description: error instanceof Error ? error.message : "An error occurred",
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
        toast({ title: "Size category updated successfully" });
      } else {
        const { error } = await supabase.from("size_categories").insert([data]);

        if (error) throw error;
        toast({ title: "Size category created successfully" });
      }

      setDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast({
        title: "Error saving size category",
        description: error instanceof Error ? error.message : "An error occurred",
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

      toast({ title: "Size category deleted successfully" });
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast({
        title: "Error deleting size category",
        description: error instanceof Error ? error.message : "An error occurred",
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
        <h2 className="text-2xl font-bold">Size Categories Management</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Size Category
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Servings</TableHead>
              <TableHead>Price Range</TableHead>
              <TableHead>Lead Time</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                <TableCell>{category.lead_time_days} days</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      category.is_active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {category.is_active ? "Active" : "Inactive"}
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
              {selectedCategory ? "Edit Size Category" : "Add Size Category"}
            </DialogTitle>
            <DialogDescription>
              {selectedCategory
                ? "Update the size category details"
                : "Create a new size category"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serving_min">Min Servings *</Label>
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
                <Label htmlFor="serving_max">Max Servings *</Label>
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
                <Label htmlFor="base_price_min">Min Price *</Label>
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
                <Label htmlFor="base_price_max">Max Price *</Label>
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
                <Label htmlFor="lead_time_days">Lead Time (days) *</Label>
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
                <Label htmlFor="delivery_radius_miles">Delivery Radius (miles)</Label>
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
              <Label htmlFor="tiers_spec">Tiers Specification (JSON)</Label>
              <Textarea
                id="tiers_spec"
                value={formData.tiers_spec}
                onChange={(e) =>
                  setFormData({ ...formData, tiers_spec: e.target.value })
                }
                placeholder='{"tier1": {...}, "tier2": {...}}'
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
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the size category "{selectedCategory?.name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
