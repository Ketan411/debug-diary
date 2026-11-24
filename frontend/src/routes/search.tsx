import { useMemo, useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileSearch,
  GitBranch,
  GitPullRequest,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { searchApi, getSelectedRepo } from "@/lib/api";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search - DebugDiary" },
      {
        name: "description",
        content:
          "Search verified debugging incidents across your team's knowledge base in DebugDiary.",
      },
      { property: "og:title", content: "Search - DebugDiary" },
      {
        property: "og:description",
        content:
          "Describe your problem and find verified incidents from your team's debugging history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

interface SearchResult {
  id: string;
  title: string;
  status: "Verified" | "Pending Review";
  matchScore: number;
  category: string;
  tags: string[];
  symptom: string;
  rootCause?: string;
  repository: string;
  evidence: string;
  evidenceType: "pr" | "commit";
}

const exampleQueries = [
  "Users are repeatedly redirected to login after their JWT expires",
  "API requests timeout during high database load",
  "React page crashes when loading large datasets",
];

function EmptyState({ onSearchAgain }: { onSearchAgain: () => void }) {
  return (
    <Card className="border-border bg-card/60">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
          <FileSearch className="h-4 w-4 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-foreground">No verified incidents found</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          We couldn&apos;t find a verified incident matching your problem.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={onSearchAgain}>
            <RefreshCw className="h-3.5 w-3.5" />
            Search Again
          </Button>
          <Button size="sm">Add Incident Manually</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const EvidenceIcon = result.evidenceType === "pr" ? GitPullRequest : GitBranch;

  return (
    <Card className="group border-border bg-card/60 transition-colors hover:border-border/80 hover:bg-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                {result.title}
              </h3>
              <Badge
                variant="outline"
                className="rounded-full border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
              >
                {result.status}
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                {result.matchScore}% match
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{result.category}</span>
              <span className="text-[10px] text-muted-foreground/60">•</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-primary" asChild>
            <Link to="/incidents/$id" params={{ id: result.id }}>
              View Incident
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Symptom
          </p>
          <p className="text-sm leading-relaxed text-foreground">{result.symptom}</p>
        </div>

        {result.rootCause && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Root Cause
            </p>
            <p className="text-sm leading-relaxed text-foreground">{result.rootCause}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{result.repository}</span>
          <span className="flex items-center gap-1 text-primary transition-colors hover:text-primary/80">
            <EvidenceIcon className="h-3 w-3" />
            {result.evidence}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 min-w-[140px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SearchPage() {
  const [query, setQuery] = useState(exampleQueries[0] ?? "");
  const [hasSearched, setHasSearched] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [repositoryFilter, setRepositoryFilter] = useState(getSelectedRepo());
  const [similarityFilter, setSimilarityFilter] = useState("All");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRepositoryFilter(getSelectedRepo());
    const handleRepoChange = () => {
      setRepositoryFilter(getSelectedRepo());
    };
    window.addEventListener("repo_change", handleRepoChange);
    return () => {
      window.removeEventListener("repo_change", handleRepoChange);
    };
  }, []);

  const executeSearch = useCallback((searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;
    setLoading(true);
    searchApi
      .search(q, {
        category: categoryFilter !== "All" ? categoryFilter : undefined,
        repository: repositoryFilter !== "All" ? repositoryFilter : undefined,
      })
      .then((res) => {
        if (res.results) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setResults(res.results as any);
        }
      })
      .catch((err) => {
        console.error("Search failed:", err);
      })
      .finally(() => setLoading(false));
  }, [query, categoryFilter, repositoryFilter]);

  useEffect(() => {
    executeSearch(query || "");
  }, [executeSearch]);

  const filteredResults = useMemo(() => {
    if (!hasSearched) return [];

    return results.filter((result) => {
      const matchesCategory = categoryFilter === "All" || result.category === categoryFilter;
      const matchesRepository =
        repositoryFilter === "All" || result.repository === repositoryFilter;
      const matchesSimilarity =
        similarityFilter === "All" ||
        (similarityFilter === "High (>80%)" && result.matchScore > 80) ||
        (similarityFilter === "Medium (50-80%)" && result.matchScore >= 50 && result.matchScore <= 80) ||
        (similarityFilter === "Low (<50%)" && result.matchScore < 50);
      return matchesCategory && matchesRepository && matchesSimilarity;
    });
  }, [hasSearched, results, categoryFilter, repositoryFilter, similarityFilter]);

  const topSimilarity = useMemo(() => {
    if (filteredResults.length === 0) return 0;
    return Math.max(...filteredResults.map((result) => result.matchScore));
  }, [filteredResults]);

  const handleSearch = () => {
    setHasSearched(true);
    executeSearch(query || "");
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setHasSearched(true);
    executeSearch(example);
  };

  return (
    <AppShell title="Search">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Search Debugging Knowledge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe your problem and find verified incidents from your team&apos;s debugging
            history.
          </p>
        </div>

        {/* Search input */}
        <Card className="border-border bg-card/60">
          <CardContent className="space-y-4 p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Describe your error or debugging problem..."
                className="h-11 pl-9 text-sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearch();
                }}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Search across verified incidents, root causes, symptoms, and tags.
              </p>
              <Button onClick={handleSearch} disabled={loading}>
                <Search className={cn("h-4 w-4", loading && "animate-spin")} />
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Example queries */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Try an example</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleExampleClick(example)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  query === example && hasSearched
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {hasSearched && (
          <div className="space-y-4">
            {/* Results header + filters */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Search Results</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredResults.length} verified incidents found
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <FilterSelect
                  label="Category"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={["All", "Authentication", "Database", "API", "CI/CD"]}
                />
                <FilterSelect
                  label="Repository"
                  value={repositoryFilter}
                  onChange={setRepositoryFilter}
                  options={["All", "acme/web-app", "acme/backend-api"]}
                />
                <FilterSelect
                  label="Similarity"
                  value={similarityFilter}
                  onChange={setSimilarityFilter}
                  options={["All", "High (>80%)", "Medium (50-80%)", "Low (<50%)"]}
                />
              </div>
            </div>

            {/* Search info */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
              {[
                { label: "Search method", value: "Hybrid search" },
                { label: "Results", value: `${filteredResults.length} verified incidents` },
                { label: "Top similarity", value: `${topSimilarity}%` },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-md border border-border bg-card/60 px-3 py-2"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {item.label}
                    </p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Results list */}
            {filteredResults.length > 0 ? (
              <div className="space-y-4">
                {filteredResults.map((result) => (
                  <ResultCard key={result.id} result={result} />
                ))}
              </div>
            ) : (
              <EmptyState onSearchAgain={() => setHasSearched(false)} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
