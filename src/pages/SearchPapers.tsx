import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookmarkPlus, Loader2, ExternalLink, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SortOption = "relevance" | "title-asc" | "title-desc" | "year-newest" | "year-oldest";

interface Paper {
  title: string;
  authors: string;
  doi: string;
  abstract: string;
  journal: string;
  year: number | null;
}

export default function SearchPapers() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");

  const sortedResults = useMemo(() => {
    const sorted = [...results];
    switch (sortBy) {
      case "title-asc":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "title-desc":
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case "year-newest":
        return sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case "year-oldest":
        return sorted.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
      default:
        return sorted;
    }
  }, [results, sortBy]);

  const searchPapers = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search/bulk?query=${encodeURIComponent(query)}&limit=10&fields=title,authors,abstract,externalIds,journal,year`
      );
      if (!res.ok) {
        // Fallback to the original endpoint
        const fallbackRes = await fetch(
          `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,authors,abstract,externalIds,journal,year`
        );
        if (!fallbackRes.ok) throw new Error("Search API unavailable");
        const fallbackData = await fallbackRes.json();
        const papers: Paper[] = (fallbackData.data || []).map((item: any) => ({
          title: item.title || "Untitled",
          authors: (item.authors || []).map((a: any) => a.name).join(", ") || "Unknown",
          doi: item.externalIds?.DOI || "",
          abstract: item.abstract || "No abstract available.",
          journal: item.journal?.name || "Unknown journal",
          year: item.year || null,
        }));
        setResults(papers);
        if (papers.length === 0) toast.info("No results found. Try different keywords.");
        return;
      }
      const data = await res.json();
      const papers: Paper[] = (data.data || []).map((item: any) => ({
        title: item.title || "Untitled",
        authors: (item.authors || []).map((a: any) => a.name).join(", ") || "Unknown",
        doi: item.externalIds?.DOI || "",
        abstract: item.abstract || "No abstract available.",
        journal: item.journal?.name || "Unknown journal",
        year: item.year || null,
      }));
      setResults(papers);
      if (papers.length === 0) toast.info("No results found. Try different keywords.");
    } catch {
      toast.error("Failed to search papers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const savePaper = async (paper: Paper) => {
    if (!user) return;
    setSaving(paper.doi);
    try {
      const { error } = await supabase.from("saved_papers").insert({
        user_id: user.id,
        paper_title: paper.title,
        authors: paper.authors,
        doi: paper.doi,
        abstract: paper.abstract,
        journal: paper.journal,
        published_year: paper.year,
      });
      if (error) throw error;
      toast.success("Paper saved to library!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save paper.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Search Academic Papers</h1>
        <p className="text-muted-foreground mt-1">Search millions of papers via Semantic Scholar's AI-powered database.</p>
      </div>

      <div className="flex gap-2 max-w-2xl">
        <Input
          placeholder="e.g. machine learning in healthcare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchPapers()}
        />
        <Button onClick={searchPapers} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">Search</span>
        </Button>
      </div>

      {results.length > 0 && (
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="year-newest">Year (Newest)</SelectItem>
              <SelectItem value="year-oldest">Year (Oldest)</SelectItem>
              <SelectItem value="title-asc">Title (A → Z)</SelectItem>
              <SelectItem value="title-desc">Title (Z → A)</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">{results.length} results</span>
        </div>
      )}

      <div className="space-y-4">
        {sortedResults.map((paper, i) => (
          <Card key={paper.doi || i}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-base leading-snug">{paper.title}</CardTitle>
                  <CardDescription>{paper.authors}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => savePaper(paper)}
                  disabled={saving === paper.doi}
                  className="shrink-0"
                >
                  {saving === paper.doi ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
                  <span className="ml-1">Save</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{paper.abstract}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {paper.journal && <Badge variant="secondary">{paper.journal}</Badge>}
                {paper.year && <Badge variant="outline">{paper.year}</Badge>}
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
    </div>
  );
}
