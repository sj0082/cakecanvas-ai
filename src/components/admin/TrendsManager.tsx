import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

interface TrendCategory {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  is_active: boolean;
  keyword_count?: number;
}

interface TrendKeyword {
  id: string;
  category_id: string;
  keyword: string;
  description: string | null;
  popularity_score: number;
  mapping_count?: number;
}

export default function TrendsManager() {
  const [categories, setCategories] = useState<TrendCategory[]>([]);
  const [keywords, setKeywords] = useState<TrendKeyword[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddKeywordOpen, setIsAddKeywordOpen] = useState(false);

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    source_type: "manual" as const
  });

  const [newKeyword, setNewKeyword] = useState({
    keyword: "",
    description: "",
    popularity_score: 0.5
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchKeywords(selectedCategory);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('trend_categories')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Failed to fetch categories');
      console.error(error);
      return;
    }

    // Count keywords for each category
    const categoriesWithCounts = await Promise.all(
      (data || []).map(async (cat) => {
        const { count } = await supabase
          .from('trend_keywords')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id);
        return { ...cat, keyword_count: count || 0 };
      })
    );

    setCategories(categoriesWithCounts);
  };

  const fetchKeywords = async (categoryId: string) => {
    const { data, error } = await supabase
      .from('trend_keywords')
      .select('*')
      .eq('category_id', categoryId)
      .order('popularity_score', { ascending: false });

    if (error) {
      toast.error('Failed to fetch keywords');
      console.error(error);
      return;
    }

    // Count mappings for each keyword
    const keywordsWithCounts = await Promise.all(
      (data || []).map(async (kw) => {
        const { count } = await supabase
          .from('trend_stylepack_mappings')
          .select('*', { count: 'exact', head: true })
          .eq('trend_keyword_id', kw.id);
        return { ...kw, mapping_count: count || 0 };
      })
    );

    setKeywords(keywordsWithCounts);
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    const { error } = await supabase
      .from('trend_categories')
      .insert([newCategory]);

    if (error) {
      toast.error('Failed to add category');
      console.error(error);
      return;
    }

    toast.success('Category added successfully');
    setIsAddCategoryOpen(false);
    setNewCategory({ name: "", description: "", source_type: "manual" });
    fetchCategories();
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.keyword.trim() || !selectedCategory) {
      toast.error('Keyword and category are required');
      return;
    }

    const { error } = await supabase
      .from('trend_keywords')
      .insert([{
        ...newKeyword,
        category_id: selectedCategory
      }]);

    if (error) {
      toast.error('Failed to add keyword');
      console.error(error);
      return;
    }

    toast.success('Keyword added successfully');
    setIsAddKeywordOpen(false);
    setNewKeyword({ keyword: "", description: "", popularity_score: 0.5 });
    fetchKeywords(selectedCategory);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? All keywords will also be deleted.')) {
      return;
    }

    const { error } = await supabase
      .from('trend_categories')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete category');
      console.error(error);
      return;
    }

    toast.success('Category deleted successfully');
    if (selectedCategory === id) {
      setSelectedCategory(null);
      setKeywords([]);
    }
    fetchCategories();
  };

  const handleDeleteKeyword = async (id: string) => {
    if (!confirm('Are you sure you want to delete this keyword?')) {
      return;
    }

    const { error } = await supabase
      .from('trend_keywords')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete keyword');
      console.error(error);
      return;
    }

    toast.success('Keyword deleted successfully');
    if (selectedCategory) {
      fetchKeywords(selectedCategory);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trend Categories</CardTitle>
              <CardDescription>Manage trend categories and their sources</CardDescription>
            </div>
            <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Category</DialogTitle>
                  <DialogDescription>Create a new trend category</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="category-name">Name</Label>
                    <Input
                      id="category-name"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      placeholder="e.g., Wedding Trends 2025"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category-description">Description</Label>
                    <Textarea
                      id="category-description"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                      placeholder="Brief description..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="category-source">Source Type</Label>
                    <Select
                      value={newCategory.source_type}
                      onValueChange={(value: any) => setNewCategory({ ...newCategory, source_type: value })}
                    >
                      <SelectTrigger id="category-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="pinterest">Pinterest</SelectItem>
                        <SelectItem value="luxury_brand">Luxury Brand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddCategory} className="w-full">Create Category</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow
                  key={cat.id}
                  className={`cursor-pointer ${selectedCategory === cat.id ? 'bg-muted' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{cat.source_type}</Badge>
                  </TableCell>
                  <TableCell>
                    {cat.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>{cat.keyword_count}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCategory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Keywords</CardTitle>
                <CardDescription>
                  Manage keywords for {categories.find(c => c.id === selectedCategory)?.name}
                </CardDescription>
              </div>
              <Dialog open={isAddKeywordOpen} onOpenChange={setIsAddKeywordOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Keyword
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Keyword</DialogTitle>
                    <DialogDescription>Create a new trend keyword</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="keyword">Keyword</Label>
                      <Input
                        id="keyword"
                        value={newKeyword.keyword}
                        onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                        placeholder="e.g., minimalist florals"
                      />
                    </div>
                    <div>
                      <Label htmlFor="keyword-description">Description</Label>
                      <Textarea
                        id="keyword-description"
                        value={newKeyword.description}
                        onChange={(e) => setNewKeyword({ ...newKeyword, description: e.target.value })}
                        placeholder="What this trend represents..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="popularity">Popularity Score: {newKeyword.popularity_score.toFixed(2)}</Label>
                      <input
                        type="range"
                        id="popularity"
                        min="0"
                        max="1"
                        step="0.1"
                        value={newKeyword.popularity_score}
                        onChange={(e) => setNewKeyword({ ...newKeyword, popularity_score: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    <Button onClick={handleAddKeyword} className="w-full">Create Keyword</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Popularity</TableHead>
                  <TableHead>Style Packs</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw) => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={kw.popularity_score * 100} className="w-24" />
                        <span className="text-sm text-muted-foreground">
                          {(kw.popularity_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{kw.mapping_count}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteKeyword(kw.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
