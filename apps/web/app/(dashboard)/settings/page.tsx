"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { updateAnalyticsConsent } from "@/components/providers/posthog-provider";

const ANALYTICS_STORAGE_KEY = "analytics-consent";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    setAnalyticsConsent(stored === "true");
  }, []);

  const handleAnalyticsToggle = async (checked: boolean) => {
    setAnalyticsConsent(checked);
    updateAnalyticsConsent(checked);

    // Sync to DB for audit trail
    try {
      await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analytics_consent: checked }),
      });
    } catch {
      // localStorage is authoritative; DB sync is best-effort
    }

    toast.success(
      checked ? "Analytics enabled" : "Analytics disabled"
    );
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Failed to request deletion");
      }
      toast.success(
        "Account deletion requested. Your data will be permanently deleted after 7 days."
      );
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to request account deletion"
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-[#2F2F2F]">
          Settings
        </h1>
        <p className="text-[#6B6B6B]">Manage your account and preferences.</p>
      </div>

      {/* Profile section */}
      <section className="rounded-xl border border-border bg-white/80 p-6">
        <h2 className="mb-4 font-serif text-lg font-medium text-[#2F2F2F]">
          Profile
        </h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Name
            </p>
            <p className="text-sm text-foreground">
              {user?.fullName ?? "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </p>
            <p className="text-sm text-foreground">
              {user?.primaryEmailAddress?.emailAddress ?? "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role
            </p>
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Student
            </span>
          </div>
        </div>
      </section>

      {/* Preferences section */}
      <section className="rounded-xl border border-border bg-white/80 p-6">
        <h2 className="mb-4 font-serif text-lg font-medium text-[#2F2F2F]">
          Preferences
        </h2>
        <div className="flex items-start gap-3">
          <Checkbox
            id="analytics-consent"
            checked={analyticsConsent}
            onCheckedChange={(checked) =>
              handleAnalyticsToggle(checked === true)
            }
            className="mt-0.5"
          />
          <label
            htmlFor="analytics-consent"
            className="cursor-pointer text-sm leading-relaxed text-foreground"
          >
            Allow optional analytics to help improve Apollo. We use PostHog
            (EU endpoint) with PII fields stripped. No data is shared with
            third parties.
          </label>
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-white/80 p-6">
        <h2 className="mb-2 font-serif text-lg font-medium text-red-700">
          Danger Zone
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This action
          is irreversible after 7 days.
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete My Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block">
                  This action is irreversible after 7 days. All projects, thesis
                  content, datasets, and files will be permanently deleted.
                </span>
                <span className="block">
                  Contact{" "}
                  <a
                    href="mailto:support@sciscribesolutions.com"
                    className="text-primary underline"
                  >
                    support@sciscribesolutions.com
                  </a>{" "}
                  within 7 days to cancel.
                </span>
                <span className="block font-medium text-foreground">
                  Type DELETE to confirm:
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteConfirmation !== "DELETE" || deleting}
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteAccount();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {deleting ? "Deleting..." : "Delete Account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
