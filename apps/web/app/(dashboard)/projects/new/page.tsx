"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewProjectPage() {
  const router = useRouter();
  const creating = useRef(false);

  useEffect(() => {
    if (creating.current) return;
    creating.current = true;

    async function create() {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Untitled Thesis",
            university_type: "generic",
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message = body?.error?.message ?? "Failed to create project.";
          toast.error(message);
          router.push("/projects");
          return;
        }

        const { data } = await res.json();
        router.push(`/projects/${data.id}/setup`);
      } catch {
        toast.error("Failed to create project. Please try again.");
        router.push("/projects");
      }
    }

    create();
  }, [router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Creating your new project&hellip;
      </p>
    </div>
  );
}
