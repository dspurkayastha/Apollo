"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ClipboardCheck,
  Trash2,
  Shield,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Citation, ProvenanceTier } from "@/lib/types/database";
import type { AuditResult } from "@/lib/citations/audit";

// ── Tier badge ──────────────────────────────────────────────────────────────

const TIER_COLOURS: Record<ProvenanceTier, string> = {
  A: "bg-[#8B9D77]/20 text-[#6B7D57]",
  B: "bg-blue-100 text-blue-800",
  C: "bg-[#D4A373]/20 text-[#B8885A]",
  D: "bg-red-100 text-red-800",
};

const TIER_LABELS: Record<ProvenanceTier, string> = {
  A: "Verified",
  B: "Confirmed",
  C: "Attested",
  D: "Unverified",
};

function TierBadge({ tier }: { tier: ProvenanceTier }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLOURS[tier]}`}
    >
      {tier}: {TIER_LABELS[tier]}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface CitationListPanelProps {
  projectId: string;
  citations: Citation[];
  onAddCitation?: () => void;
}

export function CitationListPanel({
  projectId,
  citations,
  onAddCitation,
}: CitationListPanelProps) {
  const router = useRouter();
  // Auto-expand when Tier D citations exist (via effect to avoid hydration mismatch)
  const hasTierD = citations.some((c) => c.provenance_tier === "D");
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    if (hasTierD) setIsOpen(true);
  }, [hasTierD]);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [attestingId, setAttestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reResolvingId, setReResolvingId] = useState<string | null>(null);

  const handleRunAudit = useCallback(async () => {
    setIsAuditing(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/citations/audit`,
        { method: "POST" }
      );
      if (res.ok) {
        const { data } = await res.json();
        setAuditResult(data);
      }
    } catch {
      // Audit failure is non-critical
    } finally {
      setIsAuditing(false);
    }
  }, [projectId]);

  const handleAttest = useCallback(
    async (citationId: string) => {
      setAttestingId(citationId);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/citations/${citationId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attested: true,
              evidence_type: "manual",
            }),
          }
        );
        if (res.ok) {
          router.refresh();
        }
      } catch {
        // Attest failure — user can retry
      } finally {
        setAttestingId(null);
      }
    },
    [projectId, router]
  );

  const handleDelete = useCallback(
    async (citationId: string) => {
      setDeletingId(citationId);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/citations/${citationId}`,
          { method: "DELETE" }
        );
        if (res.ok || res.status === 204) {
          router.refresh();
        }
      } catch {
        // Delete failure — user can retry
      } finally {
        setDeletingId(null);
      }
    },
    [projectId, router]
  );

  const handleReResolve = useCallback(
    async (citationId: string) => {
      setReResolvingId(citationId);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/citations/${citationId}/re-resolve`,
          { method: "POST" }
        );
        if (res.ok) {
          router.refresh();
        }
      } catch {
        // Re-resolve failure — user can retry
      } finally {
        setReResolvingId(null);
      }
    },
    [projectId, router]
  );

  const tierCounts = citations.reduce(
    (acc, c) => {
      acc[c.provenance_tier] = (acc[c.provenance_tier] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white/70 backdrop-blur-[20px]">
      {/* Collapsible header */}
      <button
        className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-black/[0.02]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-[#6B6B6B]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#6B6B6B]" />
          )}
          <span className="text-sm font-semibold text-[#2F2F2F]">
            Citations ({citations.length})
          </span>
          {/* Mini tier summary */}
          <div className="flex gap-1">
            {(["A", "B", "C", "D"] as ProvenanceTier[]).map(
              (tier) =>
                tierCounts[tier] ? (
                  <span
                    key={tier}
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLOURS[tier]}`}
                  >
                    {tier}:{tierCounts[tier]}
                  </span>
                ) : null
            )}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-black/[0.06] px-3 pb-3 pt-2 space-y-3">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onAddCitation && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddCitation}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Citation
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRunAudit()}
              disabled={isAuditing}
              className="gap-1"
            >
              {isAuditing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
              Run Audit
            </Button>
          </div>

          {/* Audit result */}
          {auditResult && (
            <div className="rounded-xl border border-black/[0.06] bg-[#FAFAFA] p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#2F2F2F]">Integrity Score</span>
                <span
                  className={`font-bold ${
                    auditResult.integrityScore >= 80
                      ? "text-[#8B9D77]"
                      : auditResult.integrityScore >= 50
                        ? "text-[#D4A373]"
                        : "text-destructive"
                  }`}
                >
                  {auditResult.integrityScore}%
                </span>
              </div>
              {auditResult.missingCitations.length > 0 && (
                <p className="text-xs text-[#D4A373]">
                  {auditResult.missingCitations.length} missing citation
                  {auditResult.missingCitations.length !== 1 ? "s" : ""} (used
                  in text but not in database)
                </p>
              )}
              {auditResult.orphanedCitations.length > 0 && (
                <p className="text-xs text-[#6B6B6B]">
                  {auditResult.orphanedCitations.length} orphaned citation
                  {auditResult.orphanedCitations.length !== 1 ? "s" : ""} (in
                  database but not used)
                </p>
              )}
              {auditResult.tierDBlocking.length > 0 && (
                <p className="text-xs text-destructive">
                  {auditResult.tierDBlocking.length} Tier D citation
                  {auditResult.tierDBlocking.length !== 1 ? "s" : ""} blocking
                  Final QC
                </p>
              )}
            </div>
          )}

          {/* Tier D help text */}
          {hasTierD && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 space-y-1">
              <p className="font-medium">Unverified citations (Tier D)</p>
              <p>
                These citations could not be verified against CrossRef or PubMed.
                You can: <strong>Re-resolve</strong> (retry lookup), <strong>Attest</strong> (confirm manually),
                or <strong>Delete</strong> and replace with a verified reference.
              </p>
              <p className="text-amber-600">Tier D citations block Final QC only — they do not block earlier phases.</p>
            </div>
          )}

          {/* Citation list */}
          {citations.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#6B6B6B]">
              No citations yet. Generate a section or add citations manually.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {citations.map((citation) => (
                <div
                  key={citation.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-black/[0.06] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-[#2F2F2F]/80">
                        {citation.cite_key}
                      </code>
                      <TierBadge tier={citation.provenance_tier} />
                    </div>
                    {citation.source_doi && (
                      <p className="mt-0.5 truncate font-mono text-[10px] text-[#6B6B6B]/70">
                        DOI: {citation.source_doi}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {citation.provenance_tier === "D" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Re-resolve citation"
                          onClick={() => void handleReResolve(citation.id)}
                          disabled={reResolvingId === citation.id}
                        >
                          {reResolvingId === citation.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Attest this citation"
                          onClick={() => void handleAttest(citation.id)}
                          disabled={attestingId === citation.id}
                        >
                          {attestingId === citation.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="Delete citation"
                      onClick={() => void handleDelete(citation.id)}
                      disabled={deletingId === citation.id}
                    >
                      {deletingId === citation.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
