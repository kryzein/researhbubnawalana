import { useState, useEffect, useCallback } from "react";
import mammoth from "mammoth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ImagePreviewModal } from "@/components/editor/ImagePreviewModal";

interface DocxViewerProps {
  filePath: string;
  fileName: string;
}

export function DocxViewer({ filePath, fileName }: DocxViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocx() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dlError } = await supabase.storage
          .from("project-papers")
          .download(filePath);

        if (dlError || !data) throw new Error(dlError?.message || "Download failed");

        const arrayBuffer = await data.arrayBuffer();

        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            convertImage: mammoth.images.imgElement(function (image) {
              return image.read("base64").then(function (imageBuffer) {
                return {
                  src: `data:${image.contentType};base64,${imageBuffer}`,
                };
              });
            }),
          }
        );

        if (!cancelled) {
          setHtml(result.value);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("DOCX viewer error:", err);
          setError(err instanceof Error ? err.message : "Failed to load document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDocx();
    return () => { cancelled = true; };
  }, [filePath]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      setPreviewImage((target as HTMLImageElement).src);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading document...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-destructive">
        <p>Failed to load: {fileName}</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="docx-viewer prose prose-sm sm:prose max-w-none px-6 py-4 bg-card border border-border rounded-lg overflow-auto min-h-[400px]"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleImageClick}
      />
      <ImagePreviewModal
        src={previewImage}
        alt={fileName}
        onClose={() => setPreviewImage(null)}
      />
    </>
  );
}
