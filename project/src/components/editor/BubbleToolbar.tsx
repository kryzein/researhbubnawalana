import { BubbleMenu } from "@tiptap/react/menus";
import { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"];

interface BubbleToolbarProps {
  editor: Editor;
}

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const currentFontSize = (editor.getAttributes("fontSize") as any)?.size?.replace("px", "") || "16";

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      className="flex items-center gap-0.5 bg-popover border border-border rounded-lg shadow-lg p-1"
    >
      <Select
        value={currentFontSize}
        onValueChange={(val) => {
          (editor.chain().focus() as any).setFontSize(`${val}px`).run();
        }}
      >
        <SelectTrigger className="w-[60px] h-8 text-xs border-0 bg-transparent">
          <Type className="h-3 w-3 mr-1 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={s}>{s}px</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} icon={<Bold className="h-4 w-4" />} />
      <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} icon={<Italic className="h-4 w-4" />} />
      <BubbleBtn onClick={() => (editor.chain().focus() as any).toggleUnderline().run()} active={editor.isActive("underline")} icon={<UnderlineIcon className="h-4 w-4" />} />
      <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} icon={<Strikethrough className="h-4 w-4" />} />
      <BubbleBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} icon={<Highlighter className="h-4 w-4" />} />

      <div className="w-px h-5 bg-border mx-0.5" />

      <BubbleBtn onClick={() => (editor.chain().focus() as any).setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} icon={<AlignLeft className="h-4 w-4" />} />
      <BubbleBtn onClick={() => (editor.chain().focus() as any).setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} icon={<AlignCenter className="h-4 w-4" />} />
      <BubbleBtn onClick={() => (editor.chain().focus() as any).setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} icon={<AlignRight className="h-4 w-4" />} />
    </BubbleMenu>
  );
}

function BubbleBtn({ onClick, active, icon }: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 min-w-[44px] min-h-[44px] ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}
