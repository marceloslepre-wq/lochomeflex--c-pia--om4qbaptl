import { useState, useEffect, useRef, useCallback } from 'react'
import { PbAuthGate } from '@/components/PbAuthGate'
import { usePbAuth } from '@/hooks/use-pb-auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Loader2, MessageCircle, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendHelenaMessage, listHelenaChats, loadHelenaMessages } from '@/services/helena'
import type { DisplayMessage } from '@/lib/skipAi'

export default function Chat() {
  return (
    <PbAuthGate>
      <ChatContent />
    </PbAuthGate>
  )
}

function ChatContent() {
  const { pbUser } = usePbAuth()
  const [conversations, setConversations] = useState<any[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [loadingConv, setLoadingConv] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConv(true)
      const data = await listHelenaChats()
      setConversations(data || [])
    } catch {
      setConversations([])
    } finally {
      setLoadingConv(false)
    }
  }, [])

  const loadMessages = useCallback(async (convId: string) => {
    try {
      setLoadingMsgs(true)
      const msgs = await loadHelenaMessages(convId)
      setMessages(msgs)
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (currentConvId) loadMessages(currentConvId)
    else setMessages([])
  }, [currentConvId, loadMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    const msg = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: msg, created: new Date().toISOString() },
    ])
    setIsStreaming(true)
    setStreamingContent('')
    try {
      const result = await sendHelenaMessage(msg, currentConvId, (_delta, full) => {
        setStreamingContent(full)
      })
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + 'a',
          role: 'assistant',
          content: result.content,
          created: new Date().toISOString(),
        },
      ])
      if (!currentConvId) setCurrentConvId(result.conversationId)
      loadConversations()
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + 'e',
          role: 'assistant',
          content: 'Erro: ' + (err as Error).message,
          created: new Date().toISOString(),
        },
      ])
    } finally {
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    setCurrentConvId(null)
    setMessages([])
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-64 flex-shrink-0 border rounded-lg flex flex-col bg-card">
        <div className="p-3 border-b">
          <Button size="sm" className="w-full" variant="outline" onClick={handleNewChat}>
            <MessageCircle className="w-4 h-4 mr-2" /> Nova Conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loadingConv ? (
              <div className="text-center py-4">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma conversa ainda.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCurrentConvId(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-muted',
                    currentConvId === c.id && 'bg-primary/10 text-primary font-medium',
                  )}
                >
                  <span className="block truncate">
                    {c.title || 'Conversa ' + c.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.updated || c.created).toLocaleDateString('pt-BR')}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col border rounded-lg bg-card overflow-hidden">
        <div className="p-3 border-b flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-semibold">Helena AI</span>
          <span className="text-xs text-muted-foreground">Assistente de Locações</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingMsgs ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Olá! Sou a Helena.</p>
              <p className="text-sm mt-1">
                Posso ajudar com consultas de inventário, clientes, locações e cobranças.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex gap-3 max-w-[85%]',
                  m.role === 'user' ? 'ml-auto flex-row-reverse' : '',
                )}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/10 text-primary',
                  )}
                >
                  {m.role === 'user' ? pbUser?.name?.[0] || 'U' : 'H'}
                </div>
                <div
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {isStreaming && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-primary/10 text-primary">
                H
              </div>
              <div className="rounded-lg px-4 py-2 text-sm bg-muted whitespace-pre-wrap">
                {streamingContent || <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Pergunte algo à Helena..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isStreaming} size="icon">
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
