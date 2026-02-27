import { createFileRoute, Link } from '@tanstack/react-router'
import { Hero } from '@/components/Hero'
import profileData from '@/data/profile.json'
import { getAllPosts } from '@/lib/blog'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const recentPosts = getAllPosts().slice(0, 3)

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-accent/20 selection:text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] bg-accent/5 blur-[120px] rounded-full opacity-20 animate-pulse-slow" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="min-h-[100vh] flex flex-col items-center justify-center -mt-16 sm:-mt-0 relative">
          <Hero />

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <Link
              to="/blogs"
              className="btn-primary text-center min-w-[180px]"
            >
              Blogs
            </Link>
            <Link
              to="/vani2"
              className="btn-primary text-center min-w-[180px]"
            >
              Conversation
            </Link>
            <Link
              to="/mcp-playground"
              className="btn-secondary text-center min-w-[180px]"
            >
              MCP Server
            </Link>
          </div>

          {recentPosts.length > 0 && (
            <div className="mt-20 w-full max-w-2xl">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-4">Recent writings</p>
              <div className="space-y-3">
                {recentPosts.map((p) => (
                  <Link
                    key={p.slug}
                    to="/blogs/$slug"
                    params={{ slug: p.slug }}
                    className="block text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:border-accent/20 hover:bg-white/10 transition-all"
                  >
                    <span className="text-sm font-display text-white group-hover:text-accent">{p.title}</span>
                    <span className="text-xs font-mono text-zinc-500 ml-2">{p.date}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-4">
                <Link to="/blogs" className="text-xs font-mono text-zinc-500 hover:text-accent transition-colors">
                  View all posts →
                </Link>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-white/5 pt-16 pb-16 mt-24">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-2">
              <a
                href={`mailto:${profileData.email}`}
                className="text-muted-foreground hover:text-white transition-colors font-mono text-sm underline decoration-zinc-800 underline-offset-4"
              >
                {profileData.email}
              </a>
            </div>
            <div className="flex flex-col gap-2 text-right">
              <SocialLink href={profileData.github} label="GitHub" />
              <SocialLink href={profileData.linkedin} label="LinkedIn" />
              <SocialLink href={profileData.x} label="X.com" />
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-xs font-mono text-zinc-600">
            © {new Date().getFullYear()} Shivam Dwivedi
          </div>
        </footer>
      </div>
    </div>
  )
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-mono text-zinc-500 hover:text-accent transition-colors uppercase tracking-wider block"
    >
      {label}
    </a>
  )
}
