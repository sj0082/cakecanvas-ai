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
  file?: File;
}

interface MultiImageUploadProps {
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  onAnalyze?: () => void;
  stylePackId: string;
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

export const MultiImageUpload = ({ images, onImagesChange, onAnalyze, stylePackId }: MultiImageUploadProps) => {
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

  // Extract magic number (first 12 bytes for WebP) for validation
  const extractMagicNumber = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer).slice(0, 12);
        const base64 = btoa(String.fromCharCode(...bytes));
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file.slice(0, 12));
    });
  };

  const mapSignError = (error: any, reqId: string): string => {
    // Network/preflight failure - no status or fetch/network error
    if (!error || !error.status || 
        error.message?.toLowerCase().includes('fetch') || 
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('failed to send')) {
      return `업로드 실패: Edge Function 호출 실패 – ${reqId}`;
    }
    
    switch (error.status) {
      case 401: return `로그인이 필요합니다 – ${reqId}`;
      case 403: return `관리자 권한이 필요합니다 – ${reqId}`;
      case 413: return `파일이 너무 큽니다(최대 20MB) – ${reqId}`;
      case 415: return `허용되지 않는 파일 형식입니다(JPG/PNG/WebP만 가능) – ${reqId}`;
      case 429: return `요청이 너무 많습니다. 잠시 후 다시 시도해주세요 – ${reqId}`;
      default:  return `업로드 실패(코드: ${error.status}) – ${reqId}`;
    }
  };

  const uploadFile = async (file: File, requestId: string): Promise<ImageData | null> => {
    try {
      console.debug(`[MultiImageUpload] [${requestId}] Starting upload for:`, file.name, file.type, file.size);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error(`[MultiImageUpload] [${requestId}] No auth session`);
        return {
          url: '',
          key: '',
          error: `로그인이 필요합니다 – ${requestId}`,
          file
        };
      }

      console.debug(`[MultiImageUpload] [${requestId}] Session valid, token length:`, session.access_token?.length);
      console.debug(`[MultiImageUpload] [${requestId}] Supabase URL:`, import.meta.env.VITE_SUPABASE_URL);

      // Extract magic number for server validation
      const magicBase64 = await extractMagicNumber(file);
      
      const requestBody = {
        filename: file.name,
        contentType: file.type,
        size: file.size,
        stylepackId: stylePackId,
        magicBase64
      };

      console.debug(`[MultiImageUpload] [${requestId}] About to invoke Edge Function...`);
      const invokeStart = Date.now();
      
      let signData: SignedUploadResponse | null = null;
      let signError: any = null;

      // 1차 시도: supabase.functions.invoke()
      const { data, error } = await supabase.functions.invoke<SignedUploadResponse>(
        'stylepack-sign-upload',
        {
          body: requestBody,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-Request-ID': requestId,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );

      console.debug(`[MultiImageUpload] [${requestId}] Invoke completed in ${Date.now() - invokeStart}ms`);
      console.debug(`[MultiImageUpload] [${requestId}] Has data:`, !!data, 'Has error:', !!error);

      if (error) {
        console.warn(`[MultiImageUpload] [${requestId}] Invoke failed, trying direct fetch fallback...`, error);
        console.error(`[MultiImageUpload] [${requestId}] Edge function error (FULL):`, JSON.stringify(error, null, 2));
        
        // 2차 시도: 직접 fetch
        try {
          const fetchStart = Date.now();
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stylepack-sign-upload`;
          
          console.debug(`[MultiImageUpload] [${requestId}] Fetching:`, url);
          
          const fetchResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'X-Request-ID': requestId,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(requestBody)
          });

          console.debug(`[MultiImageUpload] [${requestId}] Fetch completed in ${Date.now() - fetchStart}ms, status:`, fetchResponse.status);

          if (!fetchResponse.ok) {
            const errorText = await fetchResponse.text();
            console.error(`[MultiImageUpload] [${requestId}] Fetch failed:`, fetchResponse.status, errorText);
            signError = { status: fetchResponse.status, message: errorText };
          } else {
            signData = await fetchResponse.json();
            console.debug(`[MultiImageUpload] [${requestId}] Fetch succeeded, got signData`);
          }
        } catch (fetchError) {
          console.error(`[MultiImageUpload] [${requestId}] Fetch error:`, fetchError);
          signError = fetchError;
        }
      } else {
        signData = data;
      }

      // 에러 처리
      if (signError || !signData) {
        console.error(`[MultiImageUpload] [${requestId}] All methods failed:`, signError);
        const errorMsg = mapSignError(signError, requestId);
        return { url: '', key: '', error: errorMsg, file };
      }

      if (!signData.signedUrl) {
        console.error(`[MultiImageUpload] [${requestId}] Invalid response - no signedUrl:`, signData);
        return {
          url: '',
          key: '',
          error: `업로드 준비 실패 – ${requestId}`,
          file
        };
      }

      console.debug(`[MultiImageUpload] [${requestId}] Got signed URL, uploading file via SDK...`);
      
      // Try SDK upload first
      let uploadSuccess = false;
      const { error: uploadError } = await supabase
        .storage
        .from('stylepack-ref')
        .uploadToSignedUrl(signData.path, signData.token, file);

      if (uploadError) {
        console.warn(`[MultiImageUpload] [${requestId}] SDK upload failed, trying PUT fallback:`, uploadError);
        
        // Fallback to direct PUT
        try {
          const putResponse = await fetch(signData.signedUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
          });
          
          if (putResponse.ok) {
            console.debug(`[MultiImageUpload] [${requestId}] PUT fallback succeeded`);
            uploadSuccess = true;
          } else {
            console.error(`[MultiImageUpload] [${requestId}] PUT fallback failed:`, putResponse.status);
            return {
              url: '',
              key: '',
              error: `업로드 실패(${putResponse.status}) – ${requestId}`,
              file
            };
          }
        } catch (putError) {
          console.error(`[MultiImageUpload] [${requestId}] PUT fallback error:`, putError);
          return {
            url: '',
            key: '',
            error: `업로드 실패 – ${requestId}`,
            file
          };
        }
      } else {
        uploadSuccess = true;
      }

      if (uploadSuccess) {
        console.debug(`[MultiImageUpload] [${requestId}] Upload successful:`, signData.url);
        return {
          url: signData.url,
          key: signData.key
        };
      }

      return {
        url: '',
        key: '',
        error: `업로드 실패 – ${requestId}`,
        file
      };
    } catch (error) {
      console.error(`[MultiImageUpload] [${requestId}] Upload error for`, file.name, ':', error);
      return {
        url: '',
        key: '',
        error: error instanceof Error ? `${error.message} – ${requestId}` : `업로드 실패 – ${requestId}`,
        file
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
    if (!failedImage.error || !failedImage.file) {
      toast({
        title: "재시도 불가",
        description: "파일 정보가 없습니다. 다시 선택해 주세요",
        variant: "destructive"
      });
      return;
    }

    // Remove failed image from list temporarily
    const updatedImages = images.filter((_, i) => i !== index);
    onImagesChange(updatedImages);

    // Retry upload
    const requestId = crypto.randomUUID();
    const result = await uploadFile(failedImage.file, requestId);
    
    if (result) {
      onImagesChange([...updatedImages, result]);
      
      if (!result.error) {
        toast({
          title: "재시도 성공",
          description: "이미지가 업로드되었습니다"
        });
      } else {
        toast({
          title: "재시도 실패",
          description: result.error,
          variant: "destructive"
        });
      }
    }
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
      uploading: true,
      file
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

    // Improved toast messages with success/failure counts
    if (failCount > 0 && successCount > 0) {
      const firstError = failedUploads[0]?.error || '알 수 없는 오류';
      toast({
        title: "업로드 완료",
        description: `성공 ${successCount}개, 실패 ${failCount}개 (첫 오류: ${firstError})`,
        variant: "destructive"
      });
    } else if (failCount > 0) {
      const firstError = failedUploads[0]?.error || '알 수 없는 오류';
      toast({
        title: "업로드 실패",
        description: `실패 ${failCount}개: ${firstError}`,
        variant: "destructive"
      });
    } else if (successCount > 0) {
      toast({
        title: "업로드 완료",
        description: `${successCount}개 이미지 업로드 성공`
      });

      // Auto-analyze if we have 3+ images total
      const totalSuccessful = finalImages.filter(img => !img.error && !img.uploading).length;
      if (totalSuccessful >= 3 && onAnalyze) {
        console.debug(`[MultiImageUpload] [${requestId}] Auto-triggering analyze (${totalSuccessful} images)`);
        setTimeout(() => onAnalyze(), 500);
      }
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
