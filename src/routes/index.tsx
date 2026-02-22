import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Hero } from '@/components/Hero'
import { HeroInput } from '@/components/HeroInput'
import { PromptChips } from '@/components/PromptChips'
import { SectionHeader } from '@/components/SectionHeader'
import { ProjectCard } from '@/components/ProjectCard'
import { ExperienceItem } from '@/components/ExperienceItem'
import projectsData from '@/data/projects.json'
import experienceData from '@/data/experience.json'
import profileData from '@/data/profile.json'
import { getAllPosts } from '@/lib/blog'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  const navigate = useNavigate();
  const recentPosts = getAllPosts().slice(0, 3)
  const featuredProjects = [
    projectsData.projects.find((p) => p.id === "shvm-in"),
    projectsData.projects.find((p) => p.id === "vani"),
    ...projectsData.projects.filter((p) => p.id !== "shvm-in" && p.id !== "vani").slice(0, 2),
  ].filter((p): p is (typeof projectsData.projects)[number] => Boolean(p));

  const handlePromptSelect = (text: string) => {
    // @ts-ignore
    navigate({ to: '/chat', state: { query: text } });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-accent/20 selection:text-white overflow-x-hidden">

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] bg-accent/5 blur-[120px] rounded-full opacity-20 animate-pulse-slow" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">

        {/* Full Screen Entry Point */}
        <div className="min-h-[100vh] flex flex-col items-center justify-center -mt-16 sm:-mt-0 relative">

          <Hero />

          <div className="w-full max-w-2xl mt-8 mb-12 animate-fade-up px-2 z-20">
            <HeroInput />
          </div>

          <div className="w-full max-w-lg animate-fade-in-delayed px-4 z-10">
            <PromptChips onSelect={handlePromptSelect} />
          </div>

          <div className="mt-6 text-xs font-mono text-zinc-500 px-4 z-10">
            Prefer tooling? Use my MCP server at{" "}
            <a href="/mcp-playground" className="text-zinc-300 hover:text-accent transition-colors underline underline-offset-4">
              shvm.in/mcp
            </a>
            .
          </div>

        </div>

        {/* Narrative Scroll Section */}
        <div className="space-y-40 pt-24">

          {/* Identity & Philosophy */}
          <section className="max-w-2xl mx-auto text-center space-y-6 animate-on-scroll">
            <h2 className="text-3xl md:text-5xl font-display font-medium leading-tight">
              Engineering intelligence into <span className="text-accent">every interaction.</span>
            </h2>
            <div className="h-1 w-20 bg-accent/50 mx-auto rounded-full" />
            <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
              I build distributed systems that scale and AI products that feel magic.
              From optimizing edge infrastructure to shipping zero-to-one conversational interfaces.
            </p>
            <div className="pt-8">
              <button
                onClick={() => handlePromptSelect("What is your engineering philosophy?")}
                className="text-sm font-mono text-white border-b border-accent hover:border-white transition-colors pb-1"
              >
                Ask about my philosophy →
              </button>
            </div>
          </section>

          {/* Featured Projects Grid */}
          <section id="projects">
            <SectionHeader
              title="Featured Systems"
              subtitle="Selected work in distributed systems, AI infrastructure, and edge computing."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredProjects.map((p) => (
                <ProjectCard key={p.name} project={p} />
              ))}
            </div>
            <div className="text-center mt-12">
              <button onClick={() => handlePromptSelect("Show all projects")} className="btn-secondary cursor-pointer">View All via Chat</button>
            </div>
          </section>

          {/* Recent Writings */}
          <section id="writings">
            <SectionHeader
              title="Recent Writings"
              subtitle="Notes on systems, product engineering, and patterns."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentPosts.map((p) => (
                <Link
                  key={p.slug}
                  to="/blogs/$slug"
                  params={{ slug: p.slug }}
                  className="group relative p-6 rounded-2xl border border-white/5 bg-white/5 hover:border-accent/20 transition-all hover:bg-white/10 flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="text-xs font-mono text-zinc-500 mb-3">{p.date}</div>
                    <h3 className="text-lg font-display font-medium text-white group-hover:text-accent transition-colors mb-2">
                      {p.title}
                    </h3>
                    <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                      {p.summary}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs font-mono text-zinc-500 group-hover:text-zinc-300">
                    <span>Read post</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link to="/blogs" className="btn-secondary">View All Posts</Link>
            </div>
          </section>

          {/* Experience */}
          <section id="experience" className="max-w-3xl mx-auto">
            <SectionHeader
              title="Experience"
              subtitle="A timeline of technical leadership and product impact."
              className="text-center mb-16"
            />
            <div className="space-y-12 pl-4 border-l border-white/5 ml-4 md:ml-0 relative">
              {experienceData.experience.map((exp) => (
                <ExperienceItem
                  key={exp.company}
                  role={exp.role}
                  company={exp.company}
                  period={exp.period}
                  highlights={exp.highlights}
                />
              ))}
            </div>
          </section>

          {/* Open Source */}
          <section id="opensource">
            <SectionHeader
              title="Open Source"
              subtitle="Contributions to the developer ecosystem."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projectsData.open_source.map((p) => (
                <ProjectCard key={p.name} project={{ ...p, type: 'Library', problem: '' }} />
              ))}
            </div>
          </section>

          {/* Contact / Footer */}
          <footer className="border-t border-white/5 pt-24 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
              <div className="space-y-4">
                <h2 className="text-4xl font-display font-medium text-white">Let's build together.</h2>
                <a
                  href={`mailto:${profileData.email}`}
                  className="text-muted-foreground hover:text-white transition-colors text-xl font-mono block underline decoration-zinc-800 underline-offset-8"
                >
                  {profileData.email}
                </a>
              </div>

              <div className="flex flex-col gap-4 text-right">
                <SocialLink href={profileData.github} label="GitHub" />
                <SocialLink href={profileData.linkedin} label="LinkedIn" />
                <SocialLink href={profileData.x} label="X.com" />
              </div>
            </div>

            <div className="mt-24 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs font-mono text-zinc-600 gap-4">
              <span>© {new Date().getFullYear()} Shivam Dwivedi. All rights reserved.</span>
              <span className="opacity-50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                System Operational v2.0
              </span>
            </div>
          </footer>

        </div>
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
