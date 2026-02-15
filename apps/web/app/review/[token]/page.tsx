"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Loader2, AlertCircle } from "lucide-react";

const PdfViewer = dynamic(
  () =>
    import("@/components/viewer/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false }
);

interface ReviewData {
  project: {
    id: string;
    title: string;
    study_type: string | null;
    university_type: string | null;
    current_phase: number;
  };
  sections: { phase_number: number; phase_name: string; status: string; word_count: number }[];
  pdf_url: string;
  token_id: string;
}

interface Comment {
  id: string;
  reviewer_name: string;
  phase_number: number;
  comment_text: string;
  created_at: string;
}

export default function ReviewPage() {
  const params = useParams<{ token: string }>();
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Comment form
  const [reviewerName, setReviewerName] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<number>(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchReview() {
      try {
        const res = await fetch(`/api/review/${params.token}`);
        if (!res.ok) {
          const body = await res.json();
          setError(body.error?.message ?? "Invalid or expired review link");
          return;
        }
        const { data } = await res.json();
        setReviewData(data);

        // Fetch comments
        const commentsRes = await fetch(`/api/review/${params.token}/comments`);
        if (commentsRes.ok) {
          const { data: commentsData } = await commentsRes.json();
          setComments(commentsData);
        }
      } catch {
        setError("Failed to load review");
      } finally {
        setLoading(false);
      }
    }
    fetchReview();
  }, [params.token]);

  const handleSubmitComment = useCallback(async () => {
    if (!reviewerName.trim() || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/${params.token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_name: reviewerName.trim(),
          phase_number: selectedPhase,
          comment_text: commentText.trim(),
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setComments((prev) => [data, ...prev]);
        setCommentText("");
      }
    } catch {
      // Submission failed silently
    } finally {
      setSubmitting(false);
    }
  }, [params.token, reviewerName, selectedPhase, commentText]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFDFD]">
        <Loader2 className="h-8 w-8 animate-spin text-[#8B9D77]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFDFD]">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium text-[#2F2F2F]">{error}</p>
        <p className="text-sm text-[#6B6B6B]">
          The review link may have expired or been revoked.
        </p>
      </div>
    );
  }

  if (!reviewData) return null;

  return (
    <div className="min-h-screen bg-[#FDFDFD]">
      {/* Header */}
      <header className="border-b bg-white/80 px-6 py-4 backdrop-blur-[20px]">
        <div className="mx-auto max-w-screen-xl">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8B9D77]">
            Thesis Review
          </p>
          <h1 className="mt-1 font-serif text-xl font-semibold text-[#2F2F2F]">
            {reviewData.project.title}
          </h1>
          <p className="mt-0.5 text-sm text-[#6B6B6B]">
            {reviewData.project.study_type} — Phase {reviewData.project.current_phase}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-screen-xl gap-6 p-6 lg:grid-cols-[1fr_380px]">
        {/* PDF Viewer */}
        <div className="rounded-2xl border bg-white">
          <PdfViewer url={reviewData.pdf_url} />
        </div>

        {/* Comments Panel */}
        <div className="space-y-4">
          {/* Comment Form */}
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2F2F2F]">
              <MessageSquare className="h-4 w-4" />
              Leave Feedback
            </h3>

            <div className="mt-3 space-y-3">
              <input
                type="text"
                placeholder="Your name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />

              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value={0}>General</option>
                {reviewData.sections.map((s) => (
                  <option key={s.phase_number} value={s.phase_number}>
                    Phase {s.phase_number}: {s.phase_name}
                  </option>
                ))}
              </select>

              <textarea
                placeholder="Your feedback..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />

              <Button
                onClick={handleSubmitComment}
                disabled={submitting || !reviewerName.trim() || !commentText.trim()}
                className="w-full gap-2"
                size="sm"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Comment
              </Button>
            </div>
          </div>

          {/* Existing Comments */}
          {comments.length > 0 && (
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="text-sm font-semibold text-[#2F2F2F]">
                Comments ({comments.length})
              </h3>
              <div className="mt-3 space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-[#F5F5F5] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#2F2F2F]">
                        {c.reviewer_name}
                      </span>
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
          )}
        </div>
      </div>
    </div>
  );
}
