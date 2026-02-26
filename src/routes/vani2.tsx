import { createFileRoute } from "@tanstack/react-router";
import { EchoUI } from "../vani2/ui/EchoUI";

export const Route = createFileRoute("/vani2")({
  component: Vani2Route,
});

function Vani2Route() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <EchoUI />
    </div>
  );
}
