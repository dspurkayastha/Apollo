"use client";

import { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Comment {
  id: string;
  reviewer_name: string;
  phase_number: number;
  comment_text: string;
  created_at: string;
}

interface ReviewCommentsProps {
  projectId: string;
}

export function ReviewComments({ projectId }: ReviewCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    setLoading(true);
    try {
      // Fetch review tokens first, then comments via the token
      const tokensRes = await fetch(`/api/projects/${projectId}/share`);
      if (!tokensRes.ok) {
        setComments([]);
        return;
      }
      const { data: tokens } = await tokensRes.json();
      if (!tokens || tokens.length === 0) {
        setComments([]);
        return;
      }

      // Use the most recent token to fetch comments
      const latestToken = tokens[0].token;
      const commentsRes = await fetch(`/api/review/${latestToken}/comments`);
      if (commentsRes.ok) {
        const { data } = await commentsRes.json();
        setComments(data ?? []);
      }
    } catch {
      // Failed silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading comments...
      </div>
    );
  }

  if (comments.length === 0) {
    return null; // Don't show anything if no comments
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2F2F2F]">
          <MessageSquare className="h-4 w-4" />
          Supervisor Comments ({comments.length})
        </h3>
        <Button size="sm" variant="ghost" onClick={fetchComments} className="h-7 w-7 p-0">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg bg-[#F5F5F5] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.reviewer_name}</span>
              <span className="text-[10px] text-[#6B6B6B]">
                {new Date(c.created_at).toLocaleDateString("en-GB")}
              </span>
            </div>
            {c.phase_number > 0 && (
              <span className="mt-1 inline-block rounded-full bg-[#8B9D77]/10 px-2 py-0.5 text-[10px] font-medium text-[#6B7D57]">
                Phase {c.phase_number}
              </span>
            )}
            <p className="mt-1.5 text-sm leading-relaxed text-[#2F2F2F]/80">
              {c.comment_text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
