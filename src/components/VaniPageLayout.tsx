/**
 * Shared layout for Vani voice pages (home and /vani2).
 * Header + nav (sticky), scrollable main. Responsive, touch-friendly, safe areas.
 */
import { Link } from "@tanstack/react-router";
import profileData from "@/data/profile.json";

export interface VaniPageLayoutProps {
  children: React.ReactNode;
}

export function VaniPageLayout({ children }: VaniPageLayoutProps) {
  return (
    <div className=" max-h-dvh w-full overflow-x-hidden bg-black text-zinc-100 selection:bg-accent/20 selection:text-white flex flex-col">
      {/* Sticky header: responsive typography, touch targets, safe area, logo → home */}
      <header
        className="flex-shrink-0 sticky top-0 z-10 border-b border-zinc-800/80 bg-black/90 backdrop-blur-sm"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <Link
              to="/"
              className="inline-block min-h-[44px] min-w-[44px] flex items-center focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black rounded"
              aria-label="Home"
            >
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-medium tracking-tight text-white/95">
                SHVM<span className="text-accent">.</span>IN
              </h1>
            </Link>
            <p className="mt-1 text-xs sm:text-sm font-mono text-zinc-500 tracking-wide">
              AI + distributed systems. Talk to my digital twin.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Link
              to="/blogs"
              className="min-h-[44px] min-w-[44px] inline-flex items-center px-3 py-2 text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black rounded"
            >
              Blog
            </Link>
            <Link
              to="/mcp-playground"
              className="min-h-[44px] min-w-[44px] inline-flex items-center px-3 py-2 text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black rounded"
            >
              MCP
            </Link>
            <a
              href={profileData.github}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] inline-flex items-center px-3 py-2 text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black rounded"
            >
              GitHub
            </a>
            <a
              href={profileData.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] inline-flex items-center px-3 py-2 text-xs font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-black rounded"
            >
              LinkedIn
            </a>
          </nav>
        </div>
      </header>

      {/* Scrollable main: single column, no horizontal scroll, safe area bottom */}
      <main
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 py-6 sm:py-8"
        style={{
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
    </div>
  );
}
