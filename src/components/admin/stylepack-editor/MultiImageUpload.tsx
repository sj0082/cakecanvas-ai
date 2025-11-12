import { useState, useCallback } from "react";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImageData {
  url: string;
  key: string;
  uploading?: boolean;
  error?: string;
}

interface MultiImageUploadProps {
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  onAnalyze?: () => void;
}

export const MultiImageUpload = ({ images, onImagesChange, onAnalyze }: MultiImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const uploadFile = async (file: File): Promise<ImageData | null> => {
    try {
      console.log('[MultiImageUpload] Starting upload for:', file.name, file.type, file.size);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[MultiImageUpload] No auth session');
        throw new Error('Not authenticated');
      }

      console.log('[MultiImageUpload] Calling edge function...');
      const { data: signData, error: signError } = await supabase.functions.invoke(
        'admin/stylepack-sign-upload',
        {
          body: {
            filename: file.name,
            contentType: file.type,
            size: file.size
          }
        }
      );

      if (signError) {
        console.error('[MultiImageUpload] Edge function error:', signError);
        throw signError;
      }

      if (!signData || !signData.signedUrl) {
        console.error('[MultiImageUpload] Invalid response from edge function:', signData);
        throw new Error('Invalid upload URL received');
      }

      console.log('[MultiImageUpload] Got signed URL, uploading file via SDK...');
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('stylepack-ref')
        .uploadToSignedUrl(signData.path, signData.token, file);

      if (uploadError) {
        console.error('[MultiImageUpload] Upload failed:', uploadError);
        throw new Error(uploadError.message || 'Upload failed');
      }

      console.log('[MultiImageUpload] Upload successful:', signData.url);
      return {
        url: signData.url,
        key: signData.key
      };
    } catch (error) {
      console.error('[MultiImageUpload] Upload error for', file.name, ':', error);
      return {
        url: '',
        key: '',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 20 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please upload only JPG, PNG, or WebP images under 20MB",
        variant: "destructive"
      });
      return;
    }

    // Create temporary IDs for tracking
    const tempImages = validFiles.map((file, idx) => ({
      url: URL.createObjectURL(file),
      key: `temp-${Date.now()}-${idx}`,
      uploading: true
    }));

    onImagesChange([...images, ...tempImages]);

    const uploadPromises = validFiles.map(uploadFile);
    const results = await Promise.all(uploadPromises);

    // Filter out failed uploads and replace temp images with successful ones
    const successfulUploads = results.filter((r): r is ImageData => r !== null && !r.error);
    const finalImages = [...images, ...successfulUploads];

    onImagesChange(finalImages);

    const successCount = successfulUploads.length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully`
      });
    }
    if (failCount > 0) {
      toast({
        title: "Upload errors",
        description: `${failCount} image${failCount > 1 ? 's' : ''} failed to upload`,
        variant: "destructive"
      });
    }
  }, [images, onImagesChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Reference Images</h3>
        {images.length > 0 && onAnalyze && (
          <Button onClick={onAnalyze} variant="outline" size="sm">
            <AlertCircle className="mr-2 h-4 w-4" />
            Auto-Analyze
          </Button>
        )}
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag & drop images here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          JPG, PNG, WebP • Max 20MB per file
        </p>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload">
          <Button variant="outline" asChild>
            <span>Select Files</span>
          </Button>
        </label>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border">
              <img
                src={img.url}
                alt={`Reference ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {img.uploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              )}
              {img.error && (
                <div className="absolute inset-0 bg-destructive/80 flex items-center justify-center p-2">
                  <p className="text-xs text-white text-center">{img.error}</p>
                </div>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(idx)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
