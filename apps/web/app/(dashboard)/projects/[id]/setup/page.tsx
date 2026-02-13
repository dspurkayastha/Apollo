import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SetupWizard } from "@/components/wizard/setup-wizard";
import type { Project } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export default async function ProjectSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <h1 className="text-xl font-semibold">Project not found</h1>
        <p className="mt-2 text-muted-foreground">
          The project you are looking for does not exist or you do not have
          access.
        </p>
      </div>
    );
  }

  const project = data as Project;

  return <SetupWizard project={project} />;
}
