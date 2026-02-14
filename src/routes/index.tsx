import { createFileRoute } from '@tanstack/react-router'
import { Hero } from '@/components/Hero'
import { ChatShell } from '@/components/ChatShell'
import { ProjectPills } from '@/components/ProjectPills'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients for subtle depth */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-zinc-900/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-4xl space-y-8 z-10">
        <Hero />
        <ChatShell />
        <ProjectPills />
      </div>

      <div className="fixed bottom-4 right-4 text-[10px] text-zinc-600 font-mono opacity-50 hover:opacity-100 transition-opacity">
        v1.0.0 • AI-Native Portfolio
      </div>
    </div>
  )
}
