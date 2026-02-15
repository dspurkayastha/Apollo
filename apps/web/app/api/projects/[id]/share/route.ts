import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/lib/api/auth";
import { unauthorised, notFound, internalError } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // Verify project ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, title")
      .eq("id", id)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Generate a cryptographically random token
    const token = crypto.randomBytes(24).toString("hex"); // 48 chars

    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: reviewToken, error } = await supabase
      .from("review_tokens")
      .insert({
        project_id: id,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: authResult.user.id,
      })
      .select("id, token, expires_at")
      .single();

    if (error || !reviewToken) {
      console.error("Failed to create review token:", error);
      return internalError();
    }

    const origin = _request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const shareUrl = `${origin}/review/${reviewToken.token}`;

    return NextResponse.json({
      data: {
        token: reviewToken.token,
        share_url: shareUrl,
        expires_at: reviewToken.expires_at,
      },
    });
  } catch (err) {
    console.error("Share token error:", err);
    return internalError();
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { id } = await params;
    const supabase = createAdminSupabaseClient();

    // List existing tokens for this project
    const { data: tokens } = await supabase
      .from("review_tokens")
      .select("id, token, expires_at, created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ data: tokens ?? [] });
  } catch (err) {
    console.error("List tokens error:", err);
    return internalError();
  }
}
