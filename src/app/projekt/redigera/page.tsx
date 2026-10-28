"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { ProjectForm } from "@/components/ProjectForm";
import { NotFound, WithId } from "@/components/WithId";
import { Alert, PageHeader } from "@/components/ui";
import { db } from "@/lib/db/db";
import { canEdit, useProjectRole } from "@/lib/hooks";

function Edit({ id }: { id: string }) {
  const auth = useAuth();
  const project = useLiveQuery(async () => (await db().projects.get(id)) ?? null, [id]);
  const role = useProjectRole(project ?? undefined, auth.userId);
  if (project === undefined) return null;
  if (!project) return <NotFound what="Projektet" />;
  return (
    <div>
      <PageHeader title="Redigera projekt" back={`/projekt?id=${id}`} />
      {canEdit(role) ? (
        <ProjectForm key={project.id} initial={project} isNew={false} isOwner={role === "owner"} />
      ) : (
        <Alert>Du har läsbehörighet i projektet.</Alert>
      )}
    </div>
  );
}

export default function Page() {
  return <WithId render={(id) => <Edit id={id} />} />;
}
