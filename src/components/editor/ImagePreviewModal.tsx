import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewModalProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImagePreviewModal({ src, alt, onClose }: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);

  if (!src) return null;

  return (
    <Dialog open={!!src} onOpenChange={() => { setZoom(1); onClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 self-end">
          <Button
            variant="outline"
            size="icon"
            className="min-w-[44px] min-h-[44px]"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            className="min-w-[44px] min-h-[44px]"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="min-w-[44px] min-h-[44px]"
            onClick={() => { setZoom(1); onClose(); }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-auto max-h-[80vh] w-full flex items-center justify-center">
          <img
            src={src}
            alt={alt || "Preview"}
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s" }}
            className="max-w-full object-contain cursor-zoom-in"
            onClick={() => setZoom((z) => z < 2 ? z + 0.5 : 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
