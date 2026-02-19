"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchResultItem {
  doi?: string | null;
  pmid?: string | null;
  title: string;
  authors: string[];
  journal: string;
  year: number | null;
}

interface CitationSearchDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (citeKey: string) => void;
}

const DEBOUNCE_MS = 300;

export function CitationSearchDialog({
  projectId,
  open,
  onOpenChange,
  onInsert,
}: CitationSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"pubmed" | "crossref">("pubmed");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [insertingIdx, setInsertingIdx] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setTotalResults(0);
      setIsSearching(false);
      setInsertingIdx(null);
    }
  }, [open]);

  const doSearch = useCallback(
    async (q: string, src: "pubmed" | "crossref") => {
      if (q.length < 2) {
        setResults([]);
        setTotalResults(0);
        return;
      }

      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q,
          source: src,
          limit: "10",
        });
        const res = await fetch(`/api/citations/search?${params}`);
        if (res.ok) {
          const { data } = await res.json();
          setResults(data.items ?? []);
          setTotalResults(data.totalResults ?? 0);
        }
      } catch {
        // Search failure is non-critical
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void doSearch(value, source);
      }, DEBOUNCE_MS);
    },
    [source, doSearch]
  );

  const handleSourceChange = useCallback(
    (newSource: "pubmed" | "crossref") => {
      setSource(newSource);
      if (query.length >= 2) {
        void doSearch(query, newSource);
      }
    },
    [query, doSearch]
  );

  const handleInsert = useCallback(
    async (item: SearchResultItem, idx: number) => {
      setInsertingIdx(idx);
      try {
        const body: Record<string, string> = {};
        if (item.doi) body.doi = item.doi;
        else if (item.pmid) body.pmid = item.pmid;

        const res = await fetch(`/api/projects/${projectId}/citations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const { data } = await res.json();
          onInsert(data.cite_key);
        }
      } catch {
        // Insert failure — user can retry
      } finally {
        setInsertingIdx(null);
      }
    },
    [projectId, onInsert]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-h-[85vh] flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-lg font-semibold">
              Search Citations
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {/* Search bar + source toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, keyword..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="flex rounded-md border p-0.5">
              <Button
                size="sm"
                variant={source === "pubmed" ? "secondary" : "ghost"}
                onClick={() => handleSourceChange("pubmed")}
                className="h-8 px-3 text-xs"
              >
                PubMed
              </Button>
              <Button
                size="sm"
                variant={source === "crossref" ? "secondary" : "ghost"}
                onClick={() => handleSourceChange("crossref")}
                className="h-8 px-3 text-xs"
              >
                CrossRef
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isSearching && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching {source === "pubmed" ? "PubMed" : "CrossRef"}...
              </div>
            )}

            {!isSearching && query.length >= 2 && results.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {totalResults.toLocaleString()} results found
                </p>
                {results.map((item, idx) => (
                  <div
                    key={`${item.doi ?? item.pmid ?? idx}`}
                    className="flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {item.authors.slice(0, 3).join(", ")}
                        {item.authors.length > 3 && " et al."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[item.journal, item.year].filter(Boolean).join(", ")}
                      </p>
                      {item.doi && (
                        <p className="text-xs text-muted-foreground/70 font-mono">
                          DOI: {item.doi}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1"
                      onClick={() => void handleInsert(item, idx)}
                      disabled={insertingIdx === idx}
                    >
                      {insertingIdx === idx ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Insert
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!isSearching && query.length < 2 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Enter at least 2 characters to search
              </div>
            )}
          </div>

          <DialogPrimitive.Description className="sr-only">
            Search PubMed or CrossRef for citations to insert into your thesis.
          </DialogPrimitive.Description>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
