import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Upload, X } from "lucide-react";
import { cropImageToSquareBlob, squareBlobToFile } from "@/lib/cropProfileImage";

interface ProfilePictureCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  isUploading?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCancel: () => void;
  /** Called with a 512×512 JPEG of the cropped square. */
  onConfirm: (file: File) => void | Promise<void>;
}

export function ProfilePictureCropDialog({
  open,
  imageSrc,
  isUploading = false,
  onOpenChange,
  onCancel,
  onConfirm,
}: ProfilePictureCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_visible: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
  }, [imageSrc]);

  const handleConfirm = async () => {
    if (!imageSrc || !area) return;
    setBusy(true);
    try {
      const blob = await cropImageToSquareBlob(imageSrc, area);
      await onConfirm(squareBlobToFile(blob));
    } catch (error) {
      console.error("Error cropping profile picture:", error);
      alert(error instanceof Error ? error.message : "Could not crop this image. Please try another photo.");
    } finally {
      setBusy(false);
    }
  };

  const pending = busy || isUploading;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="dialog-crop-profile-picture">
        <DialogHeader>
          <DialogTitle>Crop profile picture</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="relative h-72 w-full overflow-hidden rounded-md bg-black/80">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="profile-crop-zoom">
              Zoom
            </label>
            <Slider
              id="profile-crop-zoom"
              min={1}
              max={3}
              step={0.01}
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              disabled={pending}
              data-testid="slider-crop-zoom"
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Drag to position, then zoom so your face fills the circle.
          </p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending} data-testid="button-cancel-crop">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={pending || !imageSrc} data-testid="button-confirm-crop">
            <Upload className="w-4 h-4 mr-2" />
            {pending ? "Uploading..." : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
