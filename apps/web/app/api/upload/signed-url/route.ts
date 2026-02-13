import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  validationError,
  badRequest,
  internalError,
} from "@/lib/api/errors";
import {
  generateUploadUrl,
  ALLOWED_UPLOAD_TYPES,
} from "@/lib/r2/client";

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const body = await request.json();
    const { fileName, contentType, projectId } = body as {
      fileName?: string;
      contentType?: string;
      projectId?: string;
    };

    if (!fileName || !contentType || !projectId) {
      return validationError(
        "fileName, contentType, and projectId are required"
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

    // Sanitise the file name (remove any remaining unsafe characters)
    const sanitisedFileName = fileName
      .replace(/[^\w.\-]/g, "_")
      .replace(/_{2,}/g, "_");

    const key = `projects/${projectId}/${crypto.randomUUID()}/${sanitisedFileName}`;

    const result = await generateUploadUrl(key, contentType);

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Unexpected error in POST /api/upload/signed-url:", err);
    return internalError();
  }
}
