"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ProjectForm } from "@/components/ProjectForm";
import { PageHeader } from "@/components/ui";
import { emptyProject } from "@/lib/repo";
import { SEED_TEMPLATES } from "@/lib/templates/seed";

export default function NewProjectPage() {
  const auth = useAuth();
  const [initial] = useState(() => ({ ...emptyProject(auth.orgId, auth.userId), template_ids: [SEED_TEMPLATES[0].id] }));
  return (
    <div>
      <PageHeader title="Nytt projekt" back="/" />
      <ProjectForm initial={initial} isNew isOwner />
    </div>
  );
}
