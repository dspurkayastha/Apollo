import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  validationError,
  badRequest,
  notFound,
  internalError,
} from "@/lib/api/errors";
import {
  generateUploadUrl,
  ALLOWED_UPLOAD_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/r2/client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const body = await request.json();
    const { fileName, contentType, projectId, fileSize } = body as {
      fileName?: string;
      contentType?: string;
      projectId?: string;
      fileSize?: number;
    };

    if (!fileName || !contentType || !projectId) {
      return validationError(
        "fileName, contentType, and projectId are required"
      );
    }

    // Server-side file size enforcement (IV-A7)
    if (typeof fileSize === "number" && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: "FILE_TOO_LARGE", message: "Upload exceeds 50 MB limit" } },
        { status: 413 }
      );
    }

    // Validate content type
    if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
      return badRequest(
        `File type not allowed: ${contentType}. Allowed types: ${ALLOWED_UPLOAD_TYPES.join(", ")}`
      );
    }

    // Validate file name - reject path traversal characters
    if (
      fileName.includes("..") ||
      fileName.includes("//") ||
      fileName.includes("\\")
    ) {
      return badRequest("Invalid file name: path traversal characters are not permitted");
    }

    // Verify project ownership
    const adminDb = createAdminSupabaseClient();
    const { data: project } = await adminDb
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", authResult.user.id)
      .single();

    if (!project) return notFound("Project not found");

    // Sanitise the file name (remove any remaining unsafe characters)
    const sanitisedFileName = fileName
      .replace(/[^\w.\-]/g, "_")
      .replace(/_{2,}/g, "_");

    const key = `projects/${projectId}/${crypto.randomUUID()}/${sanitisedFileName}`;

    const result = await generateUploadUrl(
      key,
      contentType,
      typeof fileSize === "number" ? fileSize : undefined
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Unexpected error in POST /api/upload/signed-url:", err);
    return internalError();
  }
}
