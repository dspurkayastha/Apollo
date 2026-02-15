"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Loader2, ExternalLink } from "lucide-react";

interface ShareDialogProps {
  projectId: string;
}

export function ShareDialog({ projectId }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
      });
      if (res.ok) {
        const { data } = await res.json();
        setShareUrl(data.share_url);
        setExpiresAt(data.expires_at);
      }
    } catch {
      // Failed silently
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const copyToClipboard = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true);
          if (!shareUrl) generateLink();
        }}
        className="gap-1.5"
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#2F2F2F]">
          Share with Supervisor
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <p className="mt-2 text-xs text-[#6B6B6B] leading-relaxed">
        Generate a read-only link for your supervisor to review the thesis PDF and leave comments. No account required.
      </p>

      {loading && (
        <div className="mt-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Generating link...</span>
        </div>
      )}

      {shareUrl && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 rounded-md border bg-[#F5F5F5] px-3 py-2 text-xs font-mono"
            />
            <Button size="sm" variant="outline" onClick={copyToClipboard} className="gap-1.5">
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {expiresAt && (
            <p className="text-[10px] text-[#6B6B6B]">
              Expires {new Date(expiresAt).toLocaleDateString("en-GB")}
            </p>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.open(shareUrl, "_blank")}
            className="gap-1.5 text-xs"
          >
            <ExternalLink className="h-3 w-3" />
            Preview link
          </Button>
        </div>
      )}

      {!loading && !shareUrl && (
        <Button
          size="sm"
          onClick={generateLink}
          className="mt-3 gap-1.5"
        >
          <Share2 className="h-3.5 w-3.5" />
          Generate Review Link
        </Button>
      )}
    </div>
  );
}
