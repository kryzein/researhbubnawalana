import { Editor } from "@tiptap/react";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Heading1, Heading2, Heading3, List, ListOrdered, SquareCheck as CheckSquare, Highlighter, Quote, Minus, Undo, Redo, AlignLeft, AlignCenter, AlignRight, AlignJustify, Table as TableIcon, ImagePlus, Type, IndentIncrease as IndentIcon, Pentagon as OutdentIcon, FileText, Rows3, Save, LayoutGrid as Layout, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PageMargins {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export type PageSize = "letter" | "legal" | "a4";

export interface PageDimensions {
  width: number;
  height: number;
  label: string;
}

export const PAGE_SIZES: Record<PageSize, PageDimensions> = {
  letter: { width: 816, height: 1056, label: "Letter (8.5\" × 11\")" },
  legal:  { width: 816, height: 1344, label: "Legal (8.5\" × 14\")" },
  a4:     { width: 794, height: 1123, label: "A4 (210mm × 297mm)" },
};

interface EditorToolbarProps {
  editor: Editor;
  projectId?: string;
  onMarginsChange?: (margins: PageMargins) => void;
  currentMargins?: PageMargins;
  onSave?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  onPageSizeChange?: (size: PageSize) => void;
  currentPageSize?: PageSize;
  onPrint?: () => void;
}

const FONT_SIZES = ["8", "10", "11", "12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "64", "72"];

const FONT_FAMILIES = [
  { label: "Default", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Bookman Old Style", value: "'Bookman Old Style', 'Bookman', serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

const LINE_SPACINGS = [
  { label: "0.5\"", value: "0.5" },
  { label: "1.0\"", value: "1" },
  { label: "1.5\"", value: "1.5" },
  { label: "2.0\"", value: "2" },
  { label: "2.5\"", value: "2.5" },
  { label: "3.0\"", value: "3" },
];

const MARGIN_VALUES = [
  { label: "0.5\"", value: "48px" },
  { label: "1.0\"", value: "96px" },
  { label: "1.5\"", value: "144px" },
  { label: "2.0\"", value: "192px" },
  { label: "2.5\"", value: "240px" },
  { label: "3.0\"", value: "288px" },
];

export const DEFAULT_MARGINS: PageMargins = {
  top: "96px",
  bottom: "96px",
  left: "96px",
  right: "96px",
};

export function EditorToolbar({ editor, projectId, onMarginsChange, currentMargins = DEFAULT_MARGINS, onSave, isSaving, hasUnsavedChanges, onPageSizeChange, currentPageSize = "letter", onPrint }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localMargins, setLocalMargins] = useState<PageMargins>(currentMargins);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);

  const handleMarginChange = (side: keyof PageMargins, value: string) => {
    const updated = { ...localMargins, [side]: value };
    setLocalMargins(updated);
    onMarginsChange?.(updated);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${session.user.id}/${projectId || "general"}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-papers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("project-papers")
        .getPublicUrl(filePath);

      (editor.chain().focus() as any).setImage({ src: publicUrl, alt: file.name }).run();
      toast.success("Image inserted");
    } catch (err) {
      console.error("Image upload failed:", err);
      toast.error("Failed to upload image");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentFontSize = (editor.getAttributes("fontSize") as any)?.size?.replace("px", "") || "16";
  const currentFontFamily = (editor.getAttributes("textStyle") as any)?.fontFamily || "inherit";
  const currentLineHeight =
    editor.getAttributes("paragraph")?.lineHeight ||
    editor.getAttributes("heading")?.lineHeight ||
    "1.5";

  const insertPageBreak = () => {
    editor.chain().focus().setHorizontalRule().run();
    editor.chain().focus().insertContent('<p></p>').run();
  };

  return (
    <div className="px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
      {/* Undo / Redo */}
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} active={false} icon={<Undo className="h-4 w-4" />} tooltip="Undo (Ctrl+Z)" />
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} active={false} icon={<Redo className="h-4 w-4" />} tooltip="Redo (Ctrl+Y)" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Font Family */}
      <Select
        value={currentFontFamily}
        onValueChange={(val) => {
          if (val === "inherit") {
            (editor.chain().focus() as any).unsetFontFamily().run();
          } else {
            (editor.chain().focus() as any).setFontFamily(val).run();
          }
        }}
      >
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              <span style={{ fontFamily: f.value }}>{f.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font Size */}
      <Select
        value={currentFontSize}
        onValueChange={(val) => {
          (editor.chain().focus() as any).setFontSize(`${val}px`).run();
        }}
      >
        <SelectTrigger className="w-[72px] h-8 text-xs">
          <Type className="h-3 w-3 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text Formatting */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} icon={<Bold className="h-4 w-4" />} tooltip="Bold (Ctrl+B)" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} icon={<Italic className="h-4 w-4" />} tooltip="Italic (Ctrl+I)" />
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).toggleUnderline().run()} active={editor.isActive("underline")} icon={<UnderlineIcon className="h-4 w-4" />} tooltip="Underline (Ctrl+U)" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} icon={<Strikethrough className="h-4 w-4" />} tooltip="Strikethrough" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} icon={<Highlighter className="h-4 w-4" />} tooltip="Highlight" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} icon={<Code className="h-4 w-4" />} tooltip="Inline Code" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} icon={<Heading1 className="h-4 w-4" />} tooltip="Heading 1" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} icon={<Heading2 className="h-4 w-4" />} tooltip="Heading 2" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} icon={<Heading3 className="h-4 w-4" />} tooltip="Heading 3" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} icon={<AlignLeft className="h-4 w-4" />} tooltip="Align Left" />
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} icon={<AlignCenter className="h-4 w-4" />} tooltip="Align Center" />
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} icon={<AlignRight className="h-4 w-4" />} tooltip="Align Right" />
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} icon={<AlignJustify className="h-4 w-4" />} tooltip="Justify" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Indent */}
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).outdent().run()} active={false} icon={<OutdentIcon className="h-4 w-4" />} tooltip="Decrease Indent" />
      <ToolbarBtn onClick={() => (editor.chain().focus() as any).indent().run()} active={false} icon={<IndentIcon className="h-4 w-4" />} tooltip="Increase Indent" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} icon={<List className="h-4 w-4" />} tooltip="Bullet List" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} icon={<ListOrdered className="h-4 w-4" />} tooltip="Ordered List" />
      <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} icon={<CheckSquare className="h-4 w-4" />} tooltip="Task List" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Insert */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} icon={<Quote className="h-4 w-4" />} tooltip="Blockquote" />
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} icon={<Minus className="h-4 w-4" />} tooltip="Horizontal Rule" />
      <ToolbarBtn
        onClick={() => (editor.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        active={editor.isActive("table")}
        icon={<TableIcon className="h-4 w-4" />}
        tooltip="Insert Table"
      />
      <ToolbarBtn
        onClick={() => fileInputRef.current?.click()}
        active={false}
        icon={<ImagePlus className="h-4 w-4" />}
        tooltip="Insert Image"
      />

      {/* Insert Page Break */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={insertPageBreak}
          >
            <FileText className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Insert Page Break</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Line Spacing */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Select
              value={LINE_SPACINGS.find((ls) => ls.value === currentLineHeight) ? currentLineHeight : "1.5"}
              onValueChange={(val) => (editor.chain().focus() as any).setLineHeight(val).run()}
            >
              <SelectTrigger className="w-[80px] h-8 text-xs gap-1">
                <Rows3 className="h-3 w-3 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_SPACINGS.map((ls) => (
                  <SelectItem key={ls.value} value={ls.value}>{ls.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Line Spacing</TooltipContent>
      </Tooltip>

      {/* Page Margins */}
      {onMarginsChange && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground gap-1">
                  Margins
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Page Margins</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle>Page Margins</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                {(["top", "bottom", "left", "right"] as const).map((side) => (
                  <div key={side} className="space-y-1.5">
                    <Label className="text-xs font-medium capitalize">{side}</Label>
                    <Select
                      value={localMargins[side]}
                      onValueChange={(val) => handleMarginChange(side, val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARGIN_VALUES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-center">
                <div
                  className="bg-white border border-border/60 shadow-sm relative"
                  style={{
                    width: "80px",
                    height: "104px",
                  }}
                >
                  <div
                    className="absolute inset-0 border border-dashed border-blue-400/60"
                    style={{
                      top: `${(parseInt(localMargins.top) / 288) * 104}px`,
                      bottom: `${(parseInt(localMargins.bottom) / 288) * 104}px`,
                      left: `${(parseInt(localMargins.left) / 288) * 80}px`,
                      right: `${(parseInt(localMargins.right) / 288) * 80}px`,
                    }}
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Page Setup */}
      <Dialog open={pageSetupOpen} onOpenChange={setPageSetupOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground gap-1">
                <Layout className="h-3.5 w-3.5" />
                Page Setup
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Page Setup</TooltipContent>
        </Tooltip>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Page Setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Paper Size</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(PAGE_SIZES) as [PageSize, PageDimensions][]).map(([key, dims]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onPageSizeChange?.(key)}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-left transition-colors hover:bg-accent ${
                      currentPageSize === key
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div
                      className={`rounded shadow-sm border ${currentPageSize === key ? "border-primary/40 bg-primary/10" : "border-border/60 bg-muted"}`}
                      style={{
                        width: `${(dims.width / 816) * 52}px`,
                        height: `${(dims.height / 1344) * 68}px`,
                      }}
                    />
                    <div className="text-center">
                      <div className="text-xs font-semibold capitalize">{key === "a4" ? "A4" : key.charAt(0).toUpperCase() + key.slice(1)}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        {key === "letter" && "8.5\" × 11\""}
                        {key === "legal" && "8.5\" × 14\""}
                        {key === "a4" && "210 × 297mm"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Margins</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["top", "bottom", "left", "right"] as const).map((side) => (
                  <div key={side} className="space-y-1">
                    <Label className="text-xs text-muted-foreground capitalize">{side}</Label>
                    <Select
                      value={localMargins[side]}
                      onValueChange={(val) => handleMarginChange(side, val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARGIN_VALUES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-center">
              <div
                className="bg-white border border-border/60 shadow-sm relative"
                style={{
                  width: `${(PAGE_SIZES[currentPageSize].width / 816) * 80}px`,
                  height: `${(PAGE_SIZES[currentPageSize].height / 1344) * 104}px`,
                }}
              >
                <div
                  className="absolute border border-dashed border-blue-400/60"
                  style={{
                    top: `${(parseInt(localMargins.top) / 288) * ((PAGE_SIZES[currentPageSize].height / 1344) * 104)}px`,
                    bottom: `${(parseInt(localMargins.bottom) / 288) * ((PAGE_SIZES[currentPageSize].height / 1344) * 104)}px`,
                    left: `${(parseInt(localMargins.left) / 288) * ((PAGE_SIZES[currentPageSize].width / 816) * 80)}px`,
                    right: `${(parseInt(localMargins.right) / 288) * ((PAGE_SIZES[currentPageSize].width / 816) * 80)}px`,
                  }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {onSave && (
        <>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={hasUnsavedChanges ? "default" : "ghost"}
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-xs"
                onClick={onSave}
                disabled={isSaving || !hasUnsavedChanges}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Save (Ctrl+S)</TooltipContent>
          </Tooltip>
        </>
      )}

      {onPrint && (
        <>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-xs"
                onClick={onPrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Print document (Ctrl+P)</TooltipContent>
          </Tooltip>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
    </div>
  );
}

function ToolbarBtn({ onClick, active, icon, tooltip }: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
