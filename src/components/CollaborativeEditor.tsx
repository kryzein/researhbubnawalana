import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TextAlign from "@tiptap/extension-text-align";
import ImageExt from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontSize from "tiptap-fontsize-extension";
import * as Y from "yjs";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { useRoom, useSelf } from "@liveblocks/react";
import { EditorToolbar, PageMargins, DEFAULT_MARGINS, PageSize, PAGE_SIZES } from "@/components/editor/EditorToolbar";
import { printDocument } from "@/lib/print-document";
import { BubbleToolbar } from "@/components/editor/BubbleToolbar";
import { ActiveUsers } from "@/components/editor/ActiveUsers";
import { ImagePreviewModal } from "@/components/editor/ImagePreviewModal";
import { FontFamily, Indent, LineHeight } from "@/lib/editor-extensions";

interface CollaborativeEditorProps {
  initialContent?: string;
  savedContent?: string;
  projectId?: string;
  documentTitle?: string;
  onContentChange?: (html: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  onEditorReady?: (setContent: (html: string) => void) => void;
  pageSize?: PageSize;
  pageMargins?: PageMargins;
  onPageSizeChange?: (size: PageSize) => void;
  onMarginsChange?: (margins: PageMargins) => void;
}

interface PagedEditorCanvasProps {
  pageSize: PageSize;
  pageMargins: PageMargins;
  children: ReactNode;
  readOnly?: boolean;
  html?: string;
}

function PagedEditorCanvas({ pageSize, pageMargins, children, readOnly, html }: PagedEditorCanvasProps) {
  const dims = PAGE_SIZES[pageSize];
  const pageGap = 24;

  const backgroundStyle = {
    backgroundImage: [
      `repeating-linear-gradient(
        to bottom,
        transparent 0px,
        transparent ${dims.height}px,
        hsl(152 14% 82%) ${dims.height}px,
        hsl(152 14% 82%) ${dims.height + pageGap}px
      )`,
    ].join(","),
    backgroundSize: `100% ${dims.height + pageGap}px`,
    backgroundPositionY: `${pageGap / 2}px`,
  };

  return (
    <div
      className="min-h-[600px] py-3 overflow-auto"
      style={{ background: "hsl(152 16% 90%)", ...backgroundStyle }}
    >
      <div
        className="mx-auto shadow-md"
        style={{
          background: "hsl(38 50% 99%)",
          width: `${dims.width}px`,
          maxWidth: "100%",
          minHeight: `${dims.height}px`,
          paddingTop: pageMargins.top,
          paddingBottom: pageMargins.bottom,
          paddingLeft: pageMargins.left,
          paddingRight: pageMargins.right,
        }}
      >
        {readOnly && html !== undefined ? (
          <div
            className="prose prose-sm sm:prose max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export { PagedEditorCanvas };

export function CollaborativeEditor(props: CollaborativeEditorProps) {
  const room = useRoom();
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<LiveblocksYjsProvider | null>(null);
  const [synced, setSynced] = useState(false);
  const [liveblocksError, setLiveblocksError] = useState(false);

  useEffect(() => {
    const yDoc = new Y.Doc();
    let yProvider: LiveblocksYjsProvider;
    let destroyed = false;

    try {
      yProvider = new LiveblocksYjsProvider(room, yDoc);
      setDoc(yDoc);
      setProvider(yProvider);
      setSynced(false);
      setLiveblocksError(false);

      const handleSync = (isSynced: boolean) => {
        if (isSynced) setSynced(true);
      };
      yProvider.on("sync", handleSync);
      if ((yProvider as unknown as { synced?: boolean }).synced) setSynced(true);

      const fallback = setTimeout(() => {
        if (!destroyed) setSynced(true);
      }, 2500);

      return () => {
        destroyed = true;
        clearTimeout(fallback);
        yProvider.off("sync", handleSync);
        yDoc.destroy();
        yProvider.destroy();
      };
    } catch {
      setLiveblocksError(true);
      yDoc.destroy();
    }
  }, [room]);

  if (liveblocksError) {
    return <StandaloneEditor {...props} />;
  }

  const ready = !!doc && !!provider && props.savedContent !== undefined && synced;

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  return <TiptapEditor doc={doc!} provider={provider!} {...props} savedContent={props.savedContent ?? ""} />;
}

interface TiptapEditorProps extends CollaborativeEditorProps {
  doc: Y.Doc;
  provider: LiveblocksYjsProvider;
  savedContent: string;
}

function TiptapEditor({ doc, provider, initialContent, savedContent, projectId, documentTitle, onContentChange, onSave, isSaving, hasUnsavedChanges, onEditorReady, pageSize: pageSizeProp, pageMargins: pageMarginsProp, onPageSizeChange, onMarginsChange }: TiptapEditorProps) {
  const currentUser = useSelf();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [internalPageMargins, setInternalPageMargins] = useState<PageMargins>(DEFAULT_MARGINS);
  const [internalPageSize, setInternalPageSize] = useState<PageSize>("letter");
  const [liveblocksReady, setLiveblocksReady] = useState(false);

  const pageSize = pageSizeProp ?? internalPageSize;
  const pageMargins = pageMarginsProp ?? internalPageMargins;

  const handlePageSizeChange = (size: PageSize) => {
    if (onPageSizeChange) onPageSizeChange(size);
    else setInternalPageSize(size);
  };

  const handleMarginsChange = (margins: PageMargins) => {
    if (onMarginsChange) onMarginsChange(margins);
    else setInternalPageMargins(margins);
  };

  const handlePrint = () => {
    if (!editor) return;
    printDocument(editor.getHTML(), documentTitle || "Document", pageSize, pageMargins);
  };

  const userName = (currentUser?.info?.name as string) || "";
  const userColor = (currentUser?.info?.color as string) || "";

  useEffect(() => {
    if (userName && userColor) {
      setLiveblocksReady(true);
      return;
    }
    const timeout = setTimeout(() => setLiveblocksReady(true), 3000);
    return () => clearTimeout(timeout);
  }, [userName, userColor]);

  const resolvedName = userName || "Anonymous";
  const resolvedColor = userColor || "#64B5F6";

  const editorExtensions = useMemo(
    () => {
      if (!liveblocksReady) return null;
      return [
        StarterKit.configure({
          undoRedo: false,
        }),
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        ImageExt.configure({
          HTMLAttributes: {
            class: "cursor-pointer max-w-full h-auto rounded-md",
          },
        }),
        Underline,
        TextStyle,
        Color,
        FontSize.configure({
          defaultSize: "16px",
          step: 2,
        }),
        FontFamily,
        Indent,
        LineHeight,
        Placeholder.configure({
          placeholder: "Start writing or paste content from your uploaded files...",
        }),
        Collaboration.configure({
          document: doc,
          field: "default",
        }),
        CollaborationCaret.configure({
          provider,
          user: { name: resolvedName, color: resolvedColor },
        }),
      ];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, provider, liveblocksReady],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions: editorExtensions ?? [],
      editorProps: {
        attributes: {
          class:
            "prose prose-sm sm:prose max-w-none focus:outline-none min-h-[600px] text-foreground",
        },
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement;
          if (target.tagName === "IMG") {
            setPreviewImage((target as HTMLImageElement).src);
            return true;
          }
          return false;
        },
      },
    },
    [doc, provider, liveblocksReady],
  );

  useEffect(() => {
    if (!editor || !resolvedName || !resolvedColor) return;
    editor.commands.updateUser({
      name: resolvedName,
      color: resolvedColor,
    });
  }, [editor, resolvedName, resolvedColor]);

  const contentLoadedRef = useRef(false);

  useEffect(() => {
    if (!editor) return;
    if (contentLoadedRef.current) return;
    contentLoadedRef.current = true;
    const yText = doc.getText("default");
    const yjsIsEmpty = yText.length === 0;
    if (yjsIsEmpty) {
      const content = initialContent || savedContent;
      if (content) {
        editor.commands.setContent(content, false);
      }
    }
  }, [editor]);

  useEffect(() => {
    if (!editor || !initialContent) return;
    editor.commands.setContent(initialContent, false);
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor || !onContentChange) return;
    const handler = () => {
      onContentChange(editor.getHTML());
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, onContentChange]);

  useEffect(() => {
    if (!onSave) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave]);

  useEffect(() => {
    if (!editor || !onEditorReady) return;
    onEditorReady((html: string) => {
      editor.commands.setContent(html);
    });
  }, [editor, onEditorReady]);

  if (!liveblocksReady || !editor) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="hidden sm:block border-b border-border bg-muted/30">
        <EditorToolbar editor={editor} projectId={projectId} onMarginsChange={handleMarginsChange} currentMargins={pageMargins} onSave={onSave} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} onPageSizeChange={handlePageSizeChange} currentPageSize={pageSize} onPrint={handlePrint} />
        <div className="flex items-center justify-end px-3 py-1.5 border-t border-border/50">
          <ActiveUsers />
        </div>
      </div>

      <div className="sm:hidden border-b border-border bg-muted/30 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Select text for formatting</span>
        <ActiveUsers />
      </div>

      <BubbleToolbar editor={editor} />

      <PagedEditorCanvas pageSize={pageSize} pageMargins={pageMargins}>
        <EditorContent editor={editor} />
      </PagedEditorCanvas>

      <ImagePreviewModal
        src={previewImage}
        alt="Editor image"
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}

export function StandaloneEditor({ initialContent, savedContent, projectId, documentTitle, onContentChange, onSave, isSaving, hasUnsavedChanges, onEditorReady, pageSize: pageSizeProp, pageMargins: pageMarginsProp, onPageSizeChange, onMarginsChange }: CollaborativeEditorProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [internalPageMargins, setInternalPageMargins] = useState<PageMargins>(DEFAULT_MARGINS);
  const [internalPageSize, setInternalPageSize] = useState<PageSize>("letter");

  const pageSize = pageSizeProp ?? internalPageSize;
  const pageMargins = pageMarginsProp ?? internalPageMargins;

  const handlePageSizeChange = (size: PageSize) => {
    if (onPageSizeChange) onPageSizeChange(size);
    else setInternalPageSize(size);
  };

  const handleMarginsChange = (margins: PageMargins) => {
    if (onMarginsChange) onMarginsChange(margins);
    else setInternalPageMargins(margins);
  };

  const handlePrint = () => {
    if (!editor) return;
    printDocument(editor.getHTML(), documentTitle || "Document", pageSize, pageMargins);
  };

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      ImageExt.configure({
        HTMLAttributes: { class: "cursor-pointer max-w-full h-auto rounded-md" },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize.configure({ defaultSize: "16px", step: 2 }),
      FontFamily,
      Indent,
      LineHeight,
      Placeholder.configure({
        placeholder: "Start writing or paste content from your uploaded files...",
      }),
    ],
    content: initialContent || savedContent || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose max-w-none focus:outline-none min-h-[600px] text-foreground",
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === "IMG") {
          setPreviewImage((target as HTMLImageElement).src);
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor || !initialContent) return;
    editor.commands.setContent(initialContent, false);
  }, [editor, initialContent]);

  useEffect(() => {
    if (!editor || !onContentChange) return;
    const handler = () => onContentChange(editor.getHTML());
    editor.on("update", handler);
    return () => editor.off("update", handler);
  }, [editor, onContentChange]);

  useEffect(() => {
    if (!onSave) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave]);

  useEffect(() => {
    if (!editor || !onEditorReady) return;
    onEditorReady((html: string) => editor.commands.setContent(html));
  }, [editor, onEditorReady]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="hidden sm:block border-b border-border bg-muted/30">
        <EditorToolbar editor={editor} projectId={projectId} onMarginsChange={handleMarginsChange} currentMargins={pageMargins} onSave={onSave} isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} onPageSizeChange={handlePageSizeChange} currentPageSize={pageSize} onPrint={handlePrint} />
      </div>

      <div className="sm:hidden border-b border-border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground font-medium">Select text for formatting</span>
      </div>

      <BubbleToolbar editor={editor} />

      <PagedEditorCanvas pageSize={pageSize} pageMargins={pageMargins}>
        <EditorContent editor={editor} />
      </PagedEditorCanvas>

      <ImagePreviewModal
        src={previewImage}
        alt="Editor image"
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
