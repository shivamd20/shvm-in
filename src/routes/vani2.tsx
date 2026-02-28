import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { VaniPageLayout } from "@/components/VaniPageLayout";
import { EchoUI } from "../vani2/ui/EchoUI";

export const Route = createFileRoute("/vani2")({
  component: Vani2Route,
});

function Vani2Route() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/vani2" || pathname === "/vani2/";

  if (!isIndex) return <Outlet />;

  return (
    <VaniPageLayout>
      <EchoUI />
    </VaniPageLayout>
  );
}
