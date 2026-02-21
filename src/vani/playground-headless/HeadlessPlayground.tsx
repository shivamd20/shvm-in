import { useState, useEffect, Suspense, lazy } from "react";

const HeadlessPlaygroundClient = lazy(() => import("./HeadlessPlaygroundClient"));

export function HeadlessPlayground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Suspense fallback={null}>
      <HeadlessPlaygroundClient />
    </Suspense>
  );
}
