import { createFileRoute } from '@tanstack/react-router'
import { ChatShell } from '@/components/ChatShell'

export const Route = createFileRoute('/chat')({
    component: ChatPage,
})

function ChatPage() {
    return <ChatShell />
}
