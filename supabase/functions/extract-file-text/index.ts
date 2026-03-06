import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder("latin1").decode(bytes);

  const paragraphs: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;

  while ((streamMatch = streamRegex.exec(text)) !== null) {
    const streamContent = streamMatch[1];
    const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    const tfRegex = /\[([^\]]*)\]\s*TJ/g;
    let tjMatch;
    const parts: string[] = [];

    while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
      const decoded = tjMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (decoded.trim()) parts.push(decoded);
    }

    let tfMatch;
    while ((tfMatch = tfRegex.exec(streamContent)) !== null) {
      const innerContent = tfMatch[1];
      const innerTj = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let innerMatch;
      while ((innerMatch = innerTj.exec(innerContent)) !== null) {
        const decoded = innerMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
        if (decoded.trim()) parts.push(decoded);
      }
    }

    if (parts.length > 0) {
      paragraphs.push(parts.join(" "));
    }
  }

  return paragraphs.join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath } = await req.json();
    if (!filePath) {
      return new Response(JSON.stringify({ error: "filePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-papers")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const fileName = filePath.split("/").pop() || "";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    let text = "";

    if (ext === "txt" || ext === "md" || ext === "rtf") {
      text = await fileData.text();
    } else if (ext === "pdf") {
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const extracted = await extractPdfText(arrayBuffer);
        if (extracted.trim().length > 10) {
          text = extracted;
        } else {
          text = `[PDF text extraction produced limited results for ${fileName}. The PDF may be scanned/image-based. Try copy-pasting the content directly into the editor.]`;
        }
      } catch (e) {
        console.error("PDF extraction error:", e);
        text = `[Could not extract text from PDF ${fileName}. The file may be image-based or encrypted.]`;
      }
    } else if (ext === "docx") {
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const documentXml = await zip.file("word/document.xml")?.async("string");

        if (documentXml) {
          const paragraphs: string[] = [];
          const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
          let pMatch;
          while ((pMatch = pRegex.exec(documentXml)) !== null) {
            const pContent = pMatch[0];
            const tParts: string[] = [];
            const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            let tMatch;
            while ((tMatch = tRegex.exec(pContent)) !== null) {
              if (tMatch[1]) tParts.push(tMatch[1]);
            }
            if (tParts.length > 0) {
              paragraphs.push(tParts.join(""));
            }
          }
          text = paragraphs.length > 0
            ? paragraphs.join("\n\n")
            : `[This Word document (${fileName}) appears to be empty or uses unsupported formatting.]`;
        } else {
          text = `[Could not find document content in ${fileName}.]`;
        }
      } catch (e) {
        console.error("DOCX extraction error:", e);
        text = `[Could not extract text from ${fileName}. You can edit the content directly in the editor.]`;
      }
    } else {
      try {
        text = await fileData.text();
        if (text.includes("\x00") || text.length > 500000) {
          text = `[This file (${fileName}) is a binary document and cannot be extracted as text. Please paste your content directly into the editor.]`;
        }
      } catch {
        text = `[Could not extract text from ${fileName}. Please paste your content directly into the editor.]`;
      }
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Extract text error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
