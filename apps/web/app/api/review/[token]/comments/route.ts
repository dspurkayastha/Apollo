import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { z } from "zod";

const commentSchema = z.object({
  reviewer_name: z.string().min(1).max(100),
  phase_number: z.number().int().min(0).max(11),
  comment_text: z.string().min(1).max(5000),
});

/**
 * Validate token and return project_id + token_id, or null if invalid.
 */
async function validateToken(
  token: string
): Promise<{ projectId: string; tokenId: string } | null> {
  const supabase = createAdminSupabaseClient();

  const { data } = await supabase
    .from("review_tokens")
    .select("id, project_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  return { projectId: data.project_id as string, tokenId: data.id as string };
}

// GET: List comments for this review token's project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const validation = await validateToken(token);

    if (!validation) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired review link" } },
        { status: 401 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: comments } = await supabase
      .from("review_comments")
      .select("id, reviewer_name, phase_number, comment_text, created_at")
      .eq("project_id", validation.projectId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ data: comments ?? [] });
  } catch (err) {
    console.error("List comments error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

// POST: Add a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const validation = await validateToken(token);

    if (!validation) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or expired review link" } },
        { status: 401 }
      );
    }

    // Rate limit: 10 comments per hour per token
    const supabaseRL = createAdminSupabaseClient();
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: recentCount } = await supabaseRL
      .from("review_comments")
      .select("id", { count: "exact", head: true })
      .eq("review_token_id", validation.tokenId)
      .gte("created_at", oneHourAgo);

    if ((recentCount ?? 0) >= 10) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many comments. Try again later." } },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid comment data" } },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: comment, error } = await supabase
      .from("review_comments")
      .insert({
        project_id: validation.projectId,
        review_token_id: validation.tokenId,
        reviewer_name: parsed.data.reviewer_name,
        phase_number: parsed.data.phase_number,
        comment_text: parsed.data.comment_text,
      })
      .select("id, reviewer_name, phase_number, comment_text, created_at")
      .single();

    if (error || !comment) {
      console.error("Failed to create comment:", error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Failed to save comment" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    console.error("Create comment error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
