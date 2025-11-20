import { useState, useEffect } from "react";
import { Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TrendImage {
  id: string;
  image_path: string;
  caption: string | null;
  palette: any;
  texture_tags: string[] | null;
  density: string | null;
  category_suggestions: any;
  is_approved: boolean;
  approved_for_stylepack_id: string | null;
  trend_sources: {
    name: string;
    credibility_score: number;
  } | null;
}

interface StylePack {
  id: string;
  name: string;
}

export const TrendImageApproval = () => {
  const [trendImages, setTrendImages] = useState<TrendImage[]>([]);
  const [stylepacks, setStylepacks] = useState<StylePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch trend images
      let query = supabase
        .from('trend_images')
        .select(`
          *,
          trend_sources(name, credibility_score)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus === "pending") {
        query = query.eq('is_approved', false);
      } else if (filterStatus === "approved") {
        query = query.eq('is_approved', true);
      }

      const { data: imagesData, error: imagesError } = await query;

      if (imagesError) throw imagesError;

      // Fetch stylepacks
      const { data: stylepacksData, error: stylepacksError } = await supabase
        .from('stylepacks')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (stylepacksError) throw stylepacksError;

      setTrendImages(imagesData || []);
      setStylepacks(stylepacksData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading data",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (imageId: string, stylepackId: string) => {
    try {
      // Update trend_images
      const { error: updateError } = await supabase
        .from('trend_images')
        .update({
          is_approved: true,
          approved_for_stylepack_id: stylepackId,
        })
        .eq('id', imageId);

      if (updateError) throw updateError;

      // Create mapping
      const { error: mappingError } = await supabase
        .from('trend_image_stylepack_mappings')
        .insert({
          trend_image_id: imageId,
          stylepack_id: stylepackId,
          weight: 0.3,
          is_active: true,
        });

      if (mappingError) throw mappingError;

      toast({
        title: "Trend image approved",
        description: "The image has been approved and mapped to the stylepack",
      });

      fetchData();
    } catch (error) {
      console.error('Approval error:', error);
      toast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('trend_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      toast({
        title: "Trend image rejected",
        description: "The image has been removed",
      });

      fetchData();
    } catch (error) {
      console.error('Rejection error:', error);
      toast({
        title: "Rejection failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const getSuggestedStylepack = (image: TrendImage): string | null => {
    if (!image.category_suggestions || !Array.isArray(image.category_suggestions)) {
      return null;
    }
    
    if (image.category_suggestions.length > 0) {
      return image.category_suggestions[0].stylepack_id;
    }
    
    return null;
  };

  const getSuggestedStylepackName = (image: TrendImage): string => {
    const suggestions = image.category_suggestions as any[];
    if (suggestions && suggestions.length > 0) {
      const stylepackId = suggestions[0].stylepack_id;
      const stylepack = stylepacks.find(sp => sp.id === stylepackId);
      return stylepack?.name || "Unknown";
    }
    return "No suggestion";
  };

  const getSimilarityScore = (image: TrendImage): number => {
    const suggestions = image.category_suggestions as any[];
    if (suggestions && suggestions.length > 0) {
      return Math.round(suggestions[0].similarity * 100);
    }
    return 0;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trend Image Approval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trend Image Approval</CardTitle>
        <CardDescription>
          Review and approve trend images for StylePack generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filter */}
        <div className="flex items-center gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Images</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Image Grid */}
        {trendImages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No trend images found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendImages.map((image) => (
              <Card key={image.id} className="overflow-hidden">
                <div className="aspect-square relative">
                  <img
                    src={image.image_path}
                    alt={image.caption || "Trend image"}
                    className="w-full h-full object-cover"
                  />
                  {image.is_approved && (
                    <Badge className="absolute top-2 right-2 bg-green-500">
                      Approved
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4 space-y-3">
                  {/* Source Info */}
                  {image.trend_sources && (
                    <div className="text-sm">
                      <span className="font-semibold">{image.trend_sources.name}</span>
                      <span className="text-muted-foreground ml-2">
                        (Credibility: {(image.trend_sources.credibility_score * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )}

                  {/* Caption */}
                  {image.caption && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {image.caption}
                    </p>
                  )}

                  {/* Analysis Results */}
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold">Suggested StylePack:</span>
                      <div className="mt-1">
                        <Badge variant="secondary">
                          {getSuggestedStylepackName(image)} ({getSimilarityScore(image)}%)
                        </Badge>
                      </div>
                    </div>

                    {image.palette && (
                      <div className="text-sm">
                        <span className="font-semibold">Palette:</span>
                        <div className="flex gap-1 mt-1">
                          {(image.palette as any).colors?.slice(0, 5).map((color: any, idx: number) => (
                            <div
                              key={idx}
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: color.hex }}
                              title={color.hex}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {image.texture_tags && image.texture_tags.length > 0 && (
                      <div className="text-sm">
                        <span className="font-semibold">Textures:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {image.texture_tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {image.density && (
                      <div className="text-sm">
                        <span className="font-semibold">Density:</span>
                        <span className="ml-2 text-muted-foreground">{image.density}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!image.is_approved && (
                    <div className="space-y-2 pt-2">
                      <StylePackSelector
                        stylepacks={stylepacks}
                        suggestedId={getSuggestedStylepack(image)}
                        onApprove={(stylepackId) => handleApprove(image.id, stylepackId)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleReject(image.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface StylePackSelectorProps {
  stylepacks: StylePack[];
  suggestedId: string | null;
  onApprove: (stylepackId: string) => void;
}

const StylePackSelector = ({ stylepacks, suggestedId, onApprove }: StylePackSelectorProps) => {
  const [selectedStylepack, setSelectedStylepack] = useState<string>(suggestedId || "");

  useEffect(() => {
    if (suggestedId) {
      setSelectedStylepack(suggestedId);
    }
  }, [suggestedId]);

  return (
    <div className="space-y-2">
      <Select value={selectedStylepack} onValueChange={setSelectedStylepack}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select StylePack" />
        </SelectTrigger>
        <SelectContent>
          {stylepacks.map((sp) => (
            <SelectItem key={sp.id} value={sp.id}>
              {sp.name}
              {sp.id === suggestedId && " (Suggested)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        className="w-full"
        onClick={() => onApprove(selectedStylepack)}
        disabled={!selectedStylepack}
      >
        <Check className="h-4 w-4 mr-2" />
        Approve
      </Button>
    </div>
  );
};
