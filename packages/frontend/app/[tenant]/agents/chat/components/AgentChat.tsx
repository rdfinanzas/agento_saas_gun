/**
 * AgentChat Component - Componente reutilizable del chat
 */

"use client"

import { useState, useEffect, useRef } from "react"
import { Send, Loader2, Code2, User, Bot, Clock } from "lucide-react"

export interface Message {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  toolName?: string
  toolResult?: any
  createdAt: string
}

interface AgentChatProps {
  initialMessages?: Message[]
  sessionId?: string | null
  onMessageSent?: (message: string) => void
  onSessionChange?: (sessionId: string) => void
  placeholder?: string
  showHeader?: boolean
  showSessions?: boolean
  compact?: boolean
}

export function AgentChat({
  initialMessages = [],
  sessionId: initialSessionId = null,
  onMessageSent,
  onSessionChange,
  placeholder = "Escribe tu mensaje...",
  showHeader = true,
  showSessions = false,
  compact = false,
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Actualizar cuando cambian las props
  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    const prompt = input.trim()
    setInput("")
    setIsLoading(true)

    abortControllerRef.current = new AbortController()

    try {
      const token = localStorage.getItem("token")

      const tempAssistantId = (Date.now() + 1).toString()
      setMessages((prev) => [
        ...prev,
        {
          id: tempAssistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ])

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/v1/ai/execute/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt,
            sessionId,
          }),
          signal: abortControllerRef.current.signal,
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6))

              if (data.sessionId && data.sessionId !== sessionId) {
                setSessionId(data.sessionId)
                onSessionChange?.(data.sessionId)
              }

              if (data.type === "content") {
                accumulatedContent += data.content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempAssistantId
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                )
              } else if (data.type === "done") {
                setIsLoading(false)
                onMessageSent?.(prompt)
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Error sending message:", error)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "system",
            content: `Error: ${error.message}`,
            createdAt: new Date().toISOString(),
          },
        ])
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${compact ? "" : "rounded-lg"}`}>
      {showHeader && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Agente Codificador</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {sessionId ? "Sesión activa" : "Nueva sesión"}
            </p>
          </div>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role !== "user" && !compact && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : message.role === "system"
                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                }`}
              >
                {message.role === "tool" && (
                  <div className="flex items-center gap-2 text-xs font-medium mb-1 opacity-70">
                    <Code2 className="w-3 h-3" />
                    {message.toolName}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
              </div>

              {message.role === "user" && !compact && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              {!compact && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800 rounded-xl p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 max-h-24"
            rows={1}
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={() => abortControllerRef.current?.abort()}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <Loader2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
