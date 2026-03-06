import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, FolderKanban, Search, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: projectCount } = useQuery({
    queryKey: ["projects-count"],
    queryFn: async () => {
      const { count } = await supabase.from("projects").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: paperCount } = useQuery({
    queryKey: ["papers-count"],
    queryFn: async () => {
      const { count } = await supabase.from("saved_papers").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const stats = [
    { title: "Projects", value: projectCount ?? 0, icon: FolderKanban, link: "/dashboard/projects" },
    { title: "Saved Papers", value: paperCount ?? 0, icon: BookOpen, link: "/dashboard/library" },
    { title: "Search Papers", value: "CrossRef", icon: Search, link: "/dashboard/search" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back!</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your research workspace.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} to={stat.link}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Search</CardTitle>
            <CardDescription>Find academic papers using CrossRef's open database.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/search" className="text-primary hover:underline text-sm font-medium">
              Go to Paper Search →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Library</CardTitle>
            <CardDescription>Access your saved research papers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/library" className="text-primary hover:underline text-sm font-medium">
              View Library →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
