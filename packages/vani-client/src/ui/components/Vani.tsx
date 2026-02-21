import { useState, useEffect, Suspense, lazy } from "react";
import type { VaniProps } from "../types";

const VaniClient = lazy(() => import("./VaniClient"));

export type { VaniProps };

export function Vani(props: VaniProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <VaniClient {...props} />
    </Suspense>
  );
}

