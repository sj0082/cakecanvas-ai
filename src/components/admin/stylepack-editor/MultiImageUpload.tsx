import { useState, useCallback, useEffect } from "react";
import { Upload, X, Loader2, AlertCircle, RefreshCw } from "lucide-react";
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

interface SignedUploadResponse {
  key: string;
  signedUrl: string;
  url: string;
  token: string;
  path: string;
}

interface SignedUploadError {
  error: string;
  code: 'unauthorized' | 'invalid_token' | 'forbidden_admin_required' | 
        'bad_request' | 'invalid_type' | 'file_too_large' | 
        'sign_error' | 'internal_error';
}

export const MultiImageUpload = ({ images, onImagesChange, onAnalyze }: MultiImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>("");
  const { toast } = useToast();

  // Check authorization on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAuthorized(false);
        setAuthError("Please sign in to upload images");
        return;
      }

      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (!hasAdminRole) {
        setIsAuthorized(false);
        setAuthError("Admin role required to upload reference images");
        return;
      }

      setIsAuthorized(true);
      setAuthError("");
    };

    checkAuth();
  }, []);

  const uploadFile = async (file: File, requestId: string): Promise<ImageData | null> => {
    try {
      console.debug(`[MultiImageUpload] [${requestId}] Starting upload for:`, file.name, file.type, file.size);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error(`[MultiImageUpload] [${requestId}] No auth session`);
        return {
          url: '',
          key: '',
          error: 'Please sign in to upload images'
        };
      }

      console.debug(`[MultiImageUpload] [${requestId}] Calling edge function...`);
      const { data: signData, error: signError } = await supabase.functions.invoke<SignedUploadResponse>(
        'admin/stylepack-sign-upload',
        {
          body: {
            filename: file.name,
            contentType: file.type,
            size: file.size
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'X-Request-ID': requestId,
          },
        }
      );

      if (signError) {
        console.error(`[MultiImageUpload] [${requestId}] Edge function error:`, signError);
        
        // Parse error response properly
        const errorData = signError as unknown as SignedUploadError;
        let errorMessage = 'Upload failed';
        
        if (errorData.code) {
          switch (errorData.code) {
            case 'unauthorized':
            case 'invalid_token':
              errorMessage = 'Please sign in again';
              break;
            case 'forbidden_admin_required':
              errorMessage = 'Admin role required';
              break;
            case 'invalid_type':
              errorMessage = 'Invalid file type. Use JPG/PNG/WebP';
              break;
            case 'file_too_large':
              errorMessage = 'File exceeds 20MB limit';
              break;
            case 'sign_error':
              errorMessage = 'Could not prepare upload. Try again';
              break;
            case 'internal_error':
              errorMessage = 'Server error. Please try again';
              break;
          }
        }
        
        return {
          url: '',
          key: '',
          error: errorMessage
        };
      }

      if (!signData || !signData.signedUrl) {
        console.error(`[MultiImageUpload] [${requestId}] Invalid response from edge function:`, signData);
        return {
          url: '',
          key: '',
          error: 'Could not prepare upload'
        };
      }

      console.debug(`[MultiImageUpload] [${requestId}] Got signed URL, uploading file via SDK...`);
      const { error: uploadError } = await supabase
        .storage
        .from('stylepack-ref')
        .uploadToSignedUrl(signData.path, signData.token, file);

      if (uploadError) {
        console.error(`[MultiImageUpload] [${requestId}] SDK upload failed:`, uploadError);
        return {
          url: '',
          key: '',
          error: 'Upload failed'
        };
      }

      console.debug(`[MultiImageUpload] [${requestId}] Upload successful:`, signData.url);
      return {
        url: signData.url,
        key: signData.key
      };
    } catch (error) {
      console.error(`[MultiImageUpload] [${requestId}] Upload error for`, file.name, ':', error);
      return {
        url: '',
        key: '',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  };

  const uploadWithConcurrency = async (files: File[], maxConcurrent: number, requestId: string): Promise<ImageData[]> => {
    const results: ImageData[] = [];
    const queue = [...files];
    const inProgress = new Map<number, Promise<ImageData | null>>();
    let nextId = 0;

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new uploads up to max concurrent
      while (inProgress.size < maxConcurrent && queue.length > 0) {
        const file = queue.shift()!;
        const id = nextId++;
        const promise = uploadFile(file, `${requestId}-${id}`);
        inProgress.set(id, promise);
      }

      // Wait for at least one to complete
      if (inProgress.size > 0) {
        const completed = await Promise.race(
          Array.from(inProgress.entries()).map(async ([id, promise]) => {
            const result = await promise;
            return { id, result };
          })
        );
        
        if (completed.result) {
          results.push(completed.result);
        }
        inProgress.delete(completed.id);
      }
    }

    return results;
  };

  const retryUpload = useCallback(async (index: number) => {
    const failedImage = images[index];
    if (!failedImage.error) return;

    // Update to uploading state
    const updatedImages = [...images];
    updatedImages[index] = { ...failedImage, uploading: true, error: undefined };
    onImagesChange(updatedImages);

    // Create a temporary file object from the failed image
    // Note: This is a simplified retry - in production you'd need to store original file
    toast({
      title: "Retry not available",
      description: "Please remove and re-upload the file",
      variant: "destructive"
    });
  }, [images, onImagesChange, toast]);

  const handleFiles = useCallback(async (files: FileList) => {
    const requestId = crypto.randomUUID();
    console.debug(`[MultiImageUpload] [${requestId}] Processing ${files.length} files`);

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

    // Upload with concurrency limit of 2
    const results = await uploadWithConcurrency(validFiles, 2, requestId);

    const successfulUploads = results.filter((r): r is ImageData => r !== null && !r.error);
    const failedUploads = results.filter(r => r && r.error);
    
    const finalImages = [
      ...images.filter((i) => !i.key.startsWith('temp-')),
      ...successfulUploads,
      ...failedUploads,
    ];

    onImagesChange(finalImages);

    const successCount = successfulUploads.length;
    const failCount = failedUploads.length;

    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} image${successCount > 1 ? 's' : ''} uploaded successfully`
      });

      // Auto-analyze if we have 3+ images total
      const totalSuccessful = finalImages.filter(img => !img.error && !img.uploading).length;
      if (totalSuccessful >= 3 && onAnalyze) {
        console.debug(`[MultiImageUpload] [${requestId}] Auto-triggering analyze (${totalSuccessful} images)`);
        setTimeout(() => onAnalyze(), 500);
      }
    }
    
    if (failCount > 0) {
      const firstError = failedUploads[0]?.error || 'Unknown error';
      toast({
        title: "Upload errors",
        description: `${failCount} failed: ${firstError}`,
        variant: "destructive"
      });
    }
  }, [images, onImagesChange, toast, onAnalyze]);

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

      {isAuthorized === false && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {authError}
        </div>
      )}

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
          <Button variant="outline" asChild disabled={isAuthorized === false}>
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
                <div className="absolute inset-0 bg-destructive/90 flex flex-col items-center justify-center p-2 gap-2">
                  <p className="text-xs text-white text-center">{img.error}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs"
                    onClick={() => retryUpload(idx)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
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
