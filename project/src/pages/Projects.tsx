import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, FolderKanban, Loader2, Upload, FileText, Download, X, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ProjectFile {
  id: string;
  project_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allFiles } = useQuery({
    queryKey: ["project-files"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_files").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProjectFile[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { error } = await supabase.from("projects").insert({ owner_id: user!.id, name, description });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-count"] });
      setOpen(false);
      toast.success("Project created!");
    },
    onError: () => toast.error("Failed to create project."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-count"] });
      queryClient.invalidateQueries({ queryKey: ["project-files"] });
      toast.success("Project deleted.");
    },
    onError: () => toast.error("Failed to delete project."),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ projectId, file }: { projectId: string; file: File }) => {
      const filePath = `${user!.id}/${projectId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("project-papers").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("project_files").insert({
        project_id: projectId,
        user_id: user!.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
      });
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files"] });
      toast.success("File uploaded!");
    },
    onError: () => toast.error("Failed to upload file."),
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (file: ProjectFile) => {
      const { error: storageError } = await supabase.storage.from("project-papers").remove([file.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("project_files").delete().eq("id", file.id);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files"] });
      toast.success("File deleted.");
    },
    onError: () => toast.error("Failed to delete file."),
  });

  const handleFileUpload = (projectId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 20MB.");
      return;
    }
    uploadMutation.mutate({ projectId, file });
    e.target.value = "";
  };

  const handleDownload = (file: ProjectFile) => {
    const { data } = supabase.storage.from("project-papers").getPublicUrl(file.file_path);
    window.open(data.publicUrl, "_blank");
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFilesForProject = (projectId: string) =>
    (allFiles || []).filter((f) => f.project_id === projectId);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({ name: fd.get("name") as string, description: fd.get("description") as string });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your research projects and upload papers.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="My Research Project" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Brief description..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(!projects || projects.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No projects yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first research project to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const files = getFilesForProject(project.id);
            const isExpanded = expandedProject === project.id;

            return (
              <Card key={project.id} className="flex flex-col">
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedProject(isExpanded ? null : project.id)}>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <CardDescription className="mt-1">{project.description || "No description"}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => {
                        const firstFile = files[0];
                        const url = firstFile
                          ? `/dashboard/editor/${project.id}?fileId=${firstFile.id}`
                          : `/dashboard/editor/${project.id}`;
                        navigate(url);
                      }}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(project.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Created {format(new Date(project.created_at), "MMM d, yyyy")}</p>
                    <div className="flex items-center gap-2">
                      {files.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {files.length} file{files.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[project.id] = el; }}
                        accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.pptx,.xlsx"
                        onChange={(e) => handleFileUpload(project.id, e)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[project.id]?.click()}
                        disabled={uploadMutation.isPending}
                      >
                        {uploadMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-3 w-3 mr-1" />
                        )}
                        Upload
                      </Button>
                    </div>
                  </div>

                  {isExpanded && files.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Uploaded Papers</p>
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm truncate">{file.file_name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/dashboard/editor/${project.id}?fileId=${file.id}`)}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(file)}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFileMutation.mutate(file)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && files.length === 0 && (
                    <div className="border-t pt-3 text-center">
                      <p className="text-xs text-muted-foreground">No papers uploaded yet. Click Upload to add files.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
