import { createFileRoute } from "@tanstack/react-router";
import { VaniPageLayout } from "@/components/VaniPageLayout";
import { EchoUI } from "@/vani2/ui/EchoUI";
import { HOMEPAGE_SYSTEM_PROMPT } from "@/lib/homePrompt";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <VaniPageLayout>
      <EchoUI systemPrompt={HOMEPAGE_SYSTEM_PROMPT} />
    </VaniPageLayout>
  );
}
