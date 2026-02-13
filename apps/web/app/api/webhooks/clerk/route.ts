import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { internalError } from "@/lib/api/errors";

interface ClerkUserCreatedEvent {
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    first_name: string | null;
    last_name: string | null;
  };
  type: string;
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return internalError("Webhook secret not configured");
  }

  // Extract svix headers for verification
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Missing svix headers" } },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  // Verify webhook signature
  let evt: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid webhook signature" } },
      { status: 400 }
    );
  }

  // Only handle user.created events
  if (evt.type !== "user.created") {
    return NextResponse.json({ received: true });
  }

  try {
    const { id, email_addresses, first_name, last_name } = evt.data;

    const email = email_addresses?.[0]?.email_address;
    if (!email) {
      console.error("No email address found in Clerk user.created event");
      return internalError("No email address in webhook payload");
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || email;

    const supabase = createAdminSupabaseClient();

    const { error } = await supabase.from("users").insert({
      clerk_user_id: id,
      email,
      name,
      role: "student",
    });

    if (error) {
      console.error("Failed to insert user from webhook:", error);
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create user record",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in Clerk webhook handler:", err);
    return internalError();
  }
}
