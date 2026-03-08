import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader as Loader2 } from "lucide-react";

interface FileViewerProps {
  filePath: string;
  fileName: string;
}

export function FileViewer({ filePath, fileName }: FileViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const isText = ["txt", "md", "rtf"].includes(ext);
  const isPdf = ext === "pdf";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isPdf) {
          const { data, error: signError } = await supabase.storage
            .from("project-papers")
            .createSignedUrl(filePath, 3600);
          if (signError || !data) throw new Error(signError?.message ?? "Could not create signed URL");
          if (!cancelled) setUrl(data.signedUrl);
        } else if (isText) {
          const { data, error: dlError } = await supabase.storage
            .from("project-papers")
            .download(filePath);
          if (dlError || !data) throw new Error(dlError?.message ?? "Download failed");
          const text = await data.text();
          if (!cancelled) setTextContent(text);
        } else {
          const { data, error: signError } = await supabase.storage
            .from("project-papers")
            .createSignedUrl(filePath, 3600);
          if (signError || !data) throw new Error(signError?.message ?? "Could not create signed URL");
          if (!cancelled) setUrl(data.signedUrl);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [filePath, isPdf, isText]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading file...
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

  if (isText && textContent !== null) {
    return (
      <div
        className="bg-white dark:bg-gray-950 shadow-md mx-auto font-mono text-sm whitespace-pre-wrap break-words"
        style={{ width: "816px", maxWidth: "100%", minHeight: "1056px", padding: "96px" }}
      >
        {textContent}
      </div>
    );
  }

  if (url) {
    return (
      <iframe
        src={url}
        title={fileName}
        className="w-full rounded-lg shadow-md bg-white"
        style={{ minHeight: "800px", height: "80vh" }}
      />
    );
  }

  return (
    <div className="text-center py-10 text-muted-foreground">
      <p>Cannot preview this file type.</p>
    </div>
  );
}
