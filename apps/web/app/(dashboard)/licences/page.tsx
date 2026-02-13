import { createServerSupabaseClient } from "@/lib/supabase/server";
import { licenceStatusClasses } from "@/lib/format";
import type { ThesisLicence, Project } from "@/lib/types/database";

export const dynamic = "force-dynamic";

interface LicenceWithProject extends ThesisLicence {
  projects?: Pick<Project, "id" | "title"> | null;
}

export default async function LicencesPage() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("thesis_licenses")
    .select("*, projects:project_id(id, title)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch licences:", error);
  }

  const licences = (data ?? []) as LicenceWithProject[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Licences</h1>
      </div>

      {licences.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-lg font-medium">No licences yet</p>
          <p className="mt-1 text-muted-foreground">
            Licences will appear here once purchased or assigned.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {licences.map((licence) => (
            <div
              key={licence.id}
              className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${licenceStatusClasses(licence.status)}`}
                  >
                    {licence.status}
                  </span>
                  <span className="text-sm font-medium">
                    {licence.plan_type.replace(/_/g, " ")}
                  </span>
                </div>
                {licence.projects && (
                  <p className="text-sm text-muted-foreground">
                    Attached to:{" "}
                    <span className="font-medium">
                      {licence.projects.title}
                    </span>
                  </p>
                )}
                {!licence.projects && licence.project_id && (
                  <p className="text-sm text-muted-foreground">
                    Attached to project
                  </p>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {licence.expires_at && (
                  <span>
                    Expires:{" "}
                    {new Date(licence.expires_at).toLocaleDateString("en-GB")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
