import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { ProfilePictureCropDialog } from "@/components/ProfilePictureCropDialog";
import { uploadProfilePictureFile } from "@/lib/uploadProfilePicture";

interface ProfilePictureUploadProps {
  currentImageUrl?: string;
  userId: string;
  fallbackInitial: string;
}

export function ProfilePictureUpload({ currentImageUrl, userId, fallbackInitial }: ProfilePictureUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 10485760) {
        alert("File size must be less than 10MB");
        return;
      }
      setPreviewUrl(URL.createObjectURL(file));
      setShowCrop(true);
    }
  };

  const handleCancel = () => {
    setShowCrop(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirm = async (file: File) => {
    setIsUploading(true);
    try {
      await uploadProfilePictureFile(file);
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      handleCancel();
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert(error instanceof Error ? error.message : "Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-6">
        <Avatar className="w-24 h-24" data-testid="avatar-profile-picture">
          <AvatarImage src={currentImageUrl} />
          <AvatarFallback className="text-2xl">{fallbackInitial}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Upload a new profile picture (max 10MB)</p>
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

      <ProfilePictureCropDialog
        open={showCrop}
        imageSrc={previewUrl}
        isUploading={isUploading}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    </>
  );
}
