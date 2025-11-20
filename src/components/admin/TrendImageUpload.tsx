import { useState, useEffect } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface TrendSource {
  id: string;
  name: string;
  platform: string;
}

export const TrendImageUpload = () => {
  const [sources, setSources] = useState<TrendSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [copyrightStatus, setCopyrightStatus] = useState("inspiration_only");
  const [attributionRequired, setAttributionRequired] = useState(false);
  const [attributionText, setAttributionText] = useState("");
  const [copyrightNotes, setCopyrightNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showNewSource, setShowNewSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourcePlatform, setNewSourcePlatform] = useState("manual");
  const { toast } = useToast();

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    const { data, error } = await supabase
      .from('trend_sources')
      .select('id, name, platform')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast({
        title: "Error fetching sources",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setSources(data || []);
  };

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) {
      toast({
        title: "Source name required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from('trend_sources')
      .insert({
        name: newSourceName,
        platform: newSourcePlatform,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error creating source",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Source created successfully",
    });

    setSources([...sources, data]);
    setSelectedSource(data.id);
    setShowNewSource(false);
    setNewSourceName("");
    setNewSourcePlatform("manual");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!selectedSource) {
      toast({
        title: "Please select a trend source",
        variant: "destructive",
      });
      return;
    }

    if (files.length === 0) {
      toast({
        title: "Please select at least one image",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const uploadedImages = [];

      for (const file of files) {
        // Upload to storage
        const fileName = `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
        const filePath = `trends/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('stylepack-ref')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('stylepack-ref')
          .getPublicUrl(filePath);

        // Create trend_images record
        const { data: trendImage, error: insertError } = await supabase
          .from('trend_images')
          .insert({
            source_id: selectedSource,
            image_path: publicUrl,
            original_url: originalUrl || null,
            caption: caption || null,
            posted_at: postedAt ? new Date(postedAt).toISOString() : null,
            copyright_status: copyrightStatus,
            attribution_required: attributionRequired,
            attribution_text: attributionText || null,
            copyright_notes: copyrightNotes || null,
            uploaded_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        uploadedImages.push(trendImage);
      }

      // Call stylepack-analyze to analyze the images
      const { error: analyzeError } = await supabase.functions.invoke('stylepack-analyze', {
        body: {
          imagePaths: uploadedImages.map(img => img.image_path),
          imageType: 'trend',
          trendImageIds: uploadedImages.map(img => img.id),
        },
      });

      if (analyzeError) {
        console.error('Analysis error:', analyzeError);
        toast({
          title: "Images uploaded but analysis failed",
          description: "You can still approve them manually",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success!",
          description: `${uploadedImages.length} trend image(s) uploaded and analyzed`,
        });
      }

      // Reset form
      setFiles([]);
      setCaption("");
      setOriginalUrl("");
      setPostedAt("");
      setCopyrightStatus("inspiration_only");
      setAttributionRequired(false);
      setAttributionText("");
      setCopyrightNotes("");

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Trend Images</CardTitle>
        <CardDescription>
          Upload trend images from social media or other sources for AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trend Source Selection */}
        <div className="space-y-2">
          <Label>Trend Source</Label>
          {!showNewSource ? (
            <div className="flex gap-2">
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name} ({source.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowNewSource(true)}>
                New Source
              </Button>
            </div>
          ) : (
            <div className="space-y-2 p-4 border rounded">
              <Input
                placeholder="Source name (e.g., 'The Wed')"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
              <Select value={newSourcePlatform} onValueChange={setNewSourcePlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="pinterest">Pinterest</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button onClick={handleCreateSource} size="sm">Create</Button>
                <Button variant="outline" onClick={() => setShowNewSource(false)} size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <Label>Images</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="mt-2"
            />
            {files.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {files.length} file(s) selected
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Caption (Optional)</Label>
            <Textarea
              placeholder="Image caption or description"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Original URL (Optional)</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={originalUrl}
              onChange={(e) => setOriginalUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Posted Date (Optional)</Label>
          <Input
            type="date"
            value={postedAt}
            onChange={(e) => setPostedAt(e.target.value)}
          />
        </div>

        {/* Copyright Information */}
        <div className="space-y-4 p-4 border rounded">
          <h3 className="font-semibold">Copyright Information</h3>
          
          <div className="space-y-2">
            <Label>Copyright Status</Label>
            <Select value={copyrightStatus} onValueChange={setCopyrightStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inspiration_only">Inspiration Only</SelectItem>
                <SelectItem value="licensed">Licensed</SelectItem>
                <SelectItem value="public_domain">Public Domain</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="attribution"
              checked={attributionRequired}
              onCheckedChange={(checked) => setAttributionRequired(checked === true)}
            />
            <Label htmlFor="attribution">Attribution Required</Label>
          </div>

          {attributionRequired && (
            <div className="space-y-2">
              <Label>Attribution Text</Label>
              <Input
                placeholder="e.g., Photo by @username"
                value={attributionText}
                onChange={(e) => setAttributionText(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Copyright Notes (Optional)</Label>
            <Textarea
              placeholder="Additional copyright information"
              value={copyrightNotes}
              onChange={(e) => setCopyrightNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleUpload}
          disabled={isUploading || !selectedSource || files.length === 0}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading and Analyzing...
            </>
          ) : (
            "Upload and Analyze"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
