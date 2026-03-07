import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoomProvider } from "@liveblocks/react";
import { CollaborativeEditor, StandaloneEditor, PagedEditorCanvas } from "@/components/CollaborativeEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader as Loader2, Share2, Copy, Check, FileText, Eye, Pencil, Download, Printer, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef, useCallback, useEffect } from "react";
import mammoth from "mammoth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClientSideSuspense } from "@liveblocks/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnsavedChangesDialog } from "@/components/editor/UnsavedChangesDialog";
import { DEFAULT_MARGINS, type PageMargins, type PageSize } from "@/components/editor/EditorToolbar";
import { printDocument } from "@/lib/print-document";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { liveblocksAuthEndpoint } from "@/lib/liveblocks";

export default function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileId = searchParams.get("fileId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "view">("edit");
  const [extractedContent, setExtractedContent] = useState<string | undefined>(undefined);
  const [extracting, setExtracting] = useState(false);
  const prevFileIdRef = useRef<string | null>(null);
  const setEditorContentRef = useRef<((html: string) => void) | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>("letter");
  const [pageMargins, setPageMargins] = useState<PageMargins>(DEFAULT_MARGINS);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [liveblocksAvailable, setLiveblocksAvailable] = useState<boolean | null>(null);
  const liveHtmlRef = useRef<string>("");
  const isSavingRef = useRef(false);
  const savedContentRef = useRef<string>("");

  useEffect(() => {
    liveblocksAuthEndpoint()
      .then(() => setLiveblocksAvailable(true))
      .catch(() => setLiveblocksAvailable(false));
  }, []);

  const { data: projectFiles, isLoading: filesLoading } = useQuery({
    queryKey: ["project-files", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_files")
        .select("id, file_name, file_type, file_path, document_content")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const isOwner = project?.owner_id === user?.id;

  const { data: collaborators, refetch: refetchCollaborators } = useQuery({
    queryKey: ["project-collaborators", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_collaborators")
        .select("id, user_id, role, profiles:user_id(display_name)")
        .eq("project_id", projectId!);
      if (error) throw error;
      return data as Array<{
        id: string;
        user_id: string;
        role: string;
        profiles: { display_name: string | null } | null;
      }>;
    },
    enabled: !!projectId && !!user,
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      type RpcResult = { id: string };
      const { data: authData } = await supabase
        .rpc("get_user_id_by_email" as never, { email: email.trim() } as never)
        .maybeSingle() as { data: RpcResult | null };

      const targetUserId = authData?.id;
      if (!targetUserId) {
        throw new Error("No user found with that email. They must have an account first.");
      }
      if (targetUserId === user?.id) {
        throw new Error("You cannot invite yourself.");
      }

      const { error } = await supabase.from("project_collaborators").insert({
        project_id: projectId!,
        user_id: targetUserId,
        invited_by: user!.id,
        role: "editor",
      });
      if (error) {
        if (error.code === "23505") throw new Error("This user is already a collaborator.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Collaborator added");
      setInviteEmail("");
      refetchCollaborators();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add collaborator");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const { error } = await supabase
        .from("project_collaborators")
        .delete()
        .eq("id", collaboratorId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collaborator removed");
      refetchCollaborators();
    },
    onError: () => toast.error("Failed to remove collaborator"),
  });

  const selectedFile = projectFiles?.find((f) => f.id === fileId);

  const currentSavedContent = fileId
    ? (selectedFile?.document_content ?? "")
    : (project?.document_content ?? "");

  if (fileId !== prevFileIdRef.current) {
    prevFileIdRef.current = fileId;
    setExtractedContent(undefined);
    setHasUnsavedChanges(false);
    liveHtmlRef.current = "";
    savedContentRef.current = currentSavedContent;
  }

  useEffect(() => {
    savedContentRef.current = currentSavedContent;
  }, [currentSavedContent]);

  const saveContent = useCallback(async (html: string) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      if (fileId) {
        const { error } = await supabase
          .from("project_files")
          .update({ document_content: html })
          .eq("id", fileId);
        if (error) throw error;
        queryClient.setQueryData(["project-files", projectId], (old: typeof projectFiles) =>
          old?.map((f) => f.id === fileId ? { ...f, document_content: html } : f)
        );
      } else {
        if (!projectId) return;
        const { error } = await supabase
          .from("projects")
          .update({ document_content: html, updated_at: new Date().toISOString() })
          .eq("id", projectId);
        if (error) throw error;
        queryClient.setQueryData(["project", projectId], (old: typeof project) =>
          old ? { ...old, document_content: html } : old
        );
      }
      savedContentRef.current = html;
      setHasUnsavedChanges(false);
      toast.success("Document saved");
    } catch {
      toast.error("Failed to save document");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [fileId, projectId, queryClient]);

  const handleSave = useCallback(() => {
    saveContent(liveHtmlRef.current);
  }, [saveContent]);

  const handleContentChange = useCallback((html: string) => {
    liveHtmlRef.current = html;
    setHasUnsavedChanges(html !== savedContentRef.current);
  }, []);

  const handleNavigateAway = useCallback((navFn: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => navFn);
      setShowUnsavedDialog(true);
    } else {
      navFn();
    }
  }, [hasUnsavedChanges]);

  const handleDialogSave = useCallback(async () => {
    await saveContent(liveHtmlRef.current);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setShowUnsavedDialog(false);
  }, [saveContent, pendingNavigation]);

  const handleDialogDiscard = useCallback(() => {
    setHasUnsavedChanges(false);
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  const handleDialogCancel = useCallback(() => {
    setPendingNavigation(null);
    setShowUnsavedDialog(false);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleExtract = useCallback(async () => {
    if (!selectedFile) return;
    setExtracting(true);
    try {
      const isDocx = selectedFile.file_name.toLowerCase().endsWith(".docx");

      if (isDocx) {
        const { data, error } = await supabase.storage
          .from("project-papers")
          .download(selectedFile.file_path);
        if (error || !data) throw new Error(error?.message || "Download failed");
        const arrayBuffer = await data.arrayBuffer();
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            convertImage: mammoth.images.imgElement((image) =>
              image.read("base64").then((buf) => ({
                src: `data:${image.contentType};base64,${buf}`,
              }))
            ),
          }
        );
        setViewMode("edit");
        if (setEditorContentRef.current) {
          setEditorContentRef.current(result.value);
        } else {
          setExtractedContent(result.value);
        }
        toast.success("File content extracted into editor");
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-file-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ filePath: selectedFile.file_path }),
          }
        );
        if (!response.ok) throw new Error("Extraction failed");
        const { text, error: extractError } = await response.json();
        if (extractError) throw new Error(extractError);
        const html = text
          .split(/\n\n+/)
          .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
          .join("");
        setViewMode("edit");
        if (setEditorContentRef.current) {
          setEditorContentRef.current(html);
        } else {
          setExtractedContent(html);
        }
        toast.success("File content extracted into editor");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not extract file content");
    } finally {
      setExtracting(false);
    }
  }, [selectedFile]);

  const shareUrl = `${window.location.origin}/dashboard/editor/${projectId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="link" onClick={() => navigate("/dashboard/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const roomId = fileId ? `project-${projectId}-file-${fileId}` : `project-${projectId}`;
  const fileSavedContent = selectedFile?.document_content ?? undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="min-w-[44px] min-h-[44px]"
            onClick={() => handleNavigateAway(() => navigate("/dashboard/projects"))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
            <p className="text-sm text-muted-foreground">{project.description || "Collaborative editor"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {projectFiles && projectFiles.length > 0 && (
            <Select
              value={fileId || "none"}
              onValueChange={(value) => {
                const doChange = () => {
                  setViewMode("edit");
                  setExtractedContent(undefined);
                  liveHtmlRef.current = "";
                  if (value === "none") {
                    setSearchParams({});
                  } else {
                    setSearchParams({ fileId: value });
                  }
                };
                handleNavigateAway(doChange);
              }}
            >
              <SelectTrigger className="w-[200px] min-h-[44px]">
                <FileText className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Select a file" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Blank document</SelectItem>
                {projectFiles.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.file_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedFile && (
            <Button
              variant="outline"
              size="sm"
              className="min-w-[44px] min-h-[44px] gap-2"
              onClick={handleExtract}
              disabled={extracting}
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {extracting ? "Extracting..." : "Extract"}
            </Button>
          )}

          {selectedFile && (
            <Button
              variant="outline"
              size="sm"
              className="min-w-[44px] min-h-[44px] gap-2"
              onClick={() => setViewMode(viewMode === "edit" ? "view" : "edit")}
            >
              {viewMode === "edit" ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {viewMode === "edit" ? "View" : "Edit"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="min-w-[44px] min-h-[44px] gap-2"
            onClick={() => {
              const content = fileId
                ? (selectedFile?.document_content ?? liveHtmlRef.current)
                : (project?.document_content ?? liveHtmlRef.current);
              const title = selectedFile ? selectedFile.file_name : (project?.name ?? "Document");
              printDocument(content || liveHtmlRef.current, title, pageSize, pageMargins);
            }}
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>

          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[44px] min-h-[44px]">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Share this project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Share this link with people you've invited below.
                  </p>
                  <div className="flex gap-2">
                    <Input value={shareUrl} readOnly className="text-xs" />
                    <Button onClick={handleCopyLink} variant="outline" size="icon" className="shrink-0">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {isOwner && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">Invite collaborator by email</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="colleague@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && inviteEmail.trim()) {
                              inviteMutation.mutate(inviteEmail.trim());
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          className="shrink-0"
                          disabled={!inviteEmail.trim() || inviteMutation.isPending}
                          onClick={() => inviteEmail.trim() && inviteMutation.mutate(inviteEmail.trim())}
                        >
                          {inviteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        The person must already have an account.
                      </p>
                    </div>
                  </>
                )}

                {collaborators && collaborators.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">People with access</p>
                      <div className="space-y-1">
                        {collaborators.map((collab) => (
                          <div key={collab.id} className="flex items-center justify-between py-1 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                                {(collab.profiles?.display_name || "?")[0].toUpperCase()}
                              </div>
                              <span className="text-sm truncate">
                                {collab.profiles?.display_name || collab.user_id.slice(0, 8) + "…"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="text-xs capitalize">
                                {collab.role}
                              </Badge>
                              {isOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeMutation.mutate(collab.id)}
                                  disabled={removeMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {viewMode === "view" && selectedFile && (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">View — {selectedFile.file_name}</span>
          </div>
          {fileSavedContent ? (
            <PagedEditorCanvas pageSize={pageSize} pageMargins={pageMargins} readOnly html={fileSavedContent} />
          ) : (
            <div className="bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center min-h-[400px] text-center gap-4 p-8">
              <p className="text-muted-foreground text-sm">
                No edited content yet. Extract the file to start editing, then save — your saved version will appear here.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => { setViewMode("edit"); handleExtract(); }}
                disabled={extracting}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {extracting ? "Extracting..." : "Extract & Edit"}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className={viewMode === "view" && selectedFile ? "hidden" : ""}>
        {liveblocksAvailable === null ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading editor...
          </div>
        ) : liveblocksAvailable ? (
          <RoomProvider
            key={fileId || "blank"}
            id={roomId}
            initialPresence={{}}
          >
            <ClientSideSuspense
              fallback={
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Connecting to collaboration session...
                </div>
              }
            >
              <CollaborativeEditor
                initialContent={extractedContent}
                savedContent={
                  fileId
                    ? (fileSavedContent ?? "")
                    : (project?.document_content ?? "")
                }
                projectId={projectId}
                documentTitle={selectedFile ? selectedFile.file_name : project?.name}
                onContentChange={handleContentChange}
                onSave={handleSave}
                isSaving={isSaving}
                hasUnsavedChanges={hasUnsavedChanges}
                onEditorReady={(fn) => { setEditorContentRef.current = fn; }}
                pageSize={pageSize}
                pageMargins={pageMargins}
                onPageSizeChange={setPageSize}
                onMarginsChange={setPageMargins}
              />
            </ClientSideSuspense>
          </RoomProvider>
        ) : (
          <StandaloneEditor
            key={fileId || "blank"}
            initialContent={extractedContent}
            savedContent={
              fileId
                ? (fileSavedContent ?? "")
                : (project?.document_content ?? "")
            }
            projectId={projectId}
            documentTitle={selectedFile ? selectedFile.file_name : project?.name}
            onContentChange={handleContentChange}
            onSave={handleSave}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            onEditorReady={(fn) => { setEditorContentRef.current = fn; }}
            pageSize={pageSize}
            pageMargins={pageMargins}
            onPageSizeChange={setPageSize}
            onMarginsChange={setPageMargins}
          />
        )}
      </div>

      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onSave={handleDialogSave}
          onDiscard={handleDialogDiscard}
          onCancel={handleDialogCancel}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
