/**
 * Agent Chat Session Page - SP-12: Frontend Chat UI
 *
 * Vista de una sesión específica del chat
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { AgentChat } from "../components/AgentChat"
import { api } from "@/lib/api"

export default function SessionPage({
  params,
}: {
  params: Promise<{ tenant: string; sessionId: string }>
}) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Redirigir a la página principal con el sessionId
    router.push(`/agents/chat?session=${sessionId}`)
  }, [sessionId, router])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Cargando sesión...</p>
      </div>
    </div>
  )
}
