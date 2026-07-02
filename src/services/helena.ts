import pb from '@/lib/pocketbase/client'
import { streamAgentChat, displayableMessages, type DisplayMessage } from '@/lib/skipAi'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export async function sendHelenaMessage(
  message: string,
  conversationId: string | null,
  onChunk: (delta: string, full: string) => void,
  signal?: AbortSignal,
): Promise<{ conversationId: string; content: string; citations?: any[] }> {
  const res = await fetch(`${PB_URL}/backend/v1/helena/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token || '',
    },
    body: JSON.stringify({ message, conversation_id: conversationId }),
    signal,
  })

  const headerConvId = res.headers.get('X-Conversation-Id')
  const result = await streamAgentChat(res, { onChunk, signal })

  return {
    conversationId: headerConvId ?? result.conversation_id,
    content: result.content,
    citations: result.citations,
  }
}

export async function listHelenaChats() {
  return await pb.send('/backend/v1/helena/chats', { method: 'GET' })
}

export async function loadHelenaMessages(conversationId: string): Promise<DisplayMessage[]> {
  const res = await fetch(`${PB_URL}/backend/v1/helena/chats/${conversationId}/messages`, {
    headers: { Authorization: pb.authStore.token || '' },
  })
  const payload = await res.json()
  if (!res.ok) throw new Error(payload?.error || 'Failed to load messages')
  return displayableMessages(payload.messages || [])
}
