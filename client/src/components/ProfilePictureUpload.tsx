import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ProfilePictureUploadProps {
  currentImageUrl?: string;
  userId: string;
  fallbackInitial: string;
}

export function ProfilePictureUpload({ currentImageUrl, userId, fallbackInitial }: ProfilePictureUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 10485760) { // 10MB
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setShowPreview(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Get upload URL
      const uploadParamsResponse = await apiRequest("POST", "/api/objects/upload");
      const uploadParams = await uploadParamsResponse.json();
      
      // Upload file directly to storage
      const uploadResponse = await fetch(uploadParams.uploadURL, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Extract object ID from upload URL
      const url = new URL(uploadParams.uploadURL);
      const pathParts = url.pathname.split('/');
      const objectId = pathParts[pathParts.length - 1];

      // Associate uploaded image with profile
      await apiRequest("PUT", "/api/profile-picture", {
        objectId: objectId,
      });

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

      // Clean up
      setShowPreview(false);
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setShowPreview(false);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex items-center gap-6">
        <Avatar className="w-24 h-24" data-testid="avatar-profile-picture">
          <AvatarImage src={currentImageUrl} />
          <AvatarFallback className="text-2xl">
            {fallbackInitial}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Upload a new profile picture (max 10MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-profile-picture"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-upload-profile-picture"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Image
          </Button>
        </div>
      </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewUrl && (
              <div className="relative">
                <Avatar className="w-48 h-48">
                  <AvatarImage src={previewUrl} className="object-cover" />
                </Avatar>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              This is how your profile picture will appear
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading}
              data-testid="button-confirm-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
