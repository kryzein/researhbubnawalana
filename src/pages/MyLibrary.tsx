import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink, Library, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MyLibrary() {
  const queryClient = useQueryClient();

  const { data: papers, isLoading } = useQuery({
    queryKey: ["saved-papers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_papers").select("*").order("saved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_papers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-papers"] });
      queryClient.invalidateQueries({ queryKey: ["papers-count"] });
      toast.success("Paper removed from library.");
    },
    onError: () => toast.error("Failed to remove paper."),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Library</h1>
        <p className="text-muted-foreground mt-1">{papers?.length ?? 0} saved papers</p>
      </div>

      {(!papers || papers.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Library className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No papers saved yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Search for papers and save them to build your library.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {papers.map((paper) => (
            <Card key={paper.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-base leading-snug">{paper.paper_title}</CardTitle>
                    <CardDescription>{paper.authors}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMutation.mutate(paper.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {paper.abstract && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{paper.abstract}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  {paper.journal && <Badge variant="secondary">{paper.journal}</Badge>}
                  {paper.published_year && <Badge variant="outline">{paper.published_year}</Badge>}
                  {paper.doi && (
                    <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> DOI
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
