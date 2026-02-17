import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/api/auth";
import {
  unauthorised,
  notFound,
  conflict,
  internalError,
} from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ lid: string; pid: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser();
    if (!authResult) return unauthorised();

    const { lid, pid } = await params;
    const { user } = authResult;
    const supabase = createAdminSupabaseClient();

    // Atomic attachment via RPC — single transaction validates + updates both rows
    const { data: result, error: rpcError } = await supabase.rpc(
      "attach_licence_to_project",
      {
        p_licence_id: lid,
        p_project_id: pid,
        p_user_id: user.id,
      }
    );

    if (rpcError) {
      console.error("Attach licence RPC error:", rpcError);
      return internalError("Failed to attach licence");
    }

    const rpcResult = result as { ok?: boolean; error?: string; detail?: string };

    if (rpcResult.error) {
      switch (rpcResult.error) {
        case "LICENCE_NOT_FOUND":
          return notFound("Licence not found");
        case "LICENCE_NOT_AVAILABLE":
          return conflict(
            `Licence is not available. Current status: ${rpcResult.detail ?? "unknown"}`
          );
        case "PROJECT_NOT_FOUND":
          return notFound("Project not found");
        case "PROJECT_NOT_SANDBOX":
          return conflict(
            `Project is not in sandbox status. Current status: ${rpcResult.detail ?? "unknown"}`
          );
        default:
          return internalError("Failed to attach licence");
      }
    }

    // Fetch updated project for response
    const { data: updatedProject } = await supabase
      .from("projects")
      .select("*")
      .eq("id", pid)
      .single();

    return NextResponse.json({ data: updatedProject });
  } catch (err) {
    console.error(
      "Unexpected error in POST /api/licenses/[lid]/attach/[pid]:",
      err
    );
    return internalError();
  }
}
