import { createFileRoute } from "@tanstack/react-router";
import { HeadlessPlayground } from "../vani/playground-headless/HeadlessPlayground";

export const Route = createFileRoute("/vani-headless")({
  component: VaniHeadlessRoute,
});

function VaniHeadlessRoute() {
  return <HeadlessPlayground />;
}

