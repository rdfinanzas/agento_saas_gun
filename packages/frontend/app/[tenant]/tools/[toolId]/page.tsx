/**
 * Tool Execution Page - SP-13: Frontend - Ejecutar Herramienta
 *
 * Interfaz para ejecutar una herramienta personalizada
 */

"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Play, Code2, ArrowLeft, Clock, Settings, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { use } from "react"

interface Tool {
  id: string
  name: string
  description: string
  code: string
  isActive: boolean
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
}

interface ExecutionResult {
  success: boolean
  result?: any
  error?: string
  durationMs?: number
  executedAt?: string
}

export default function ToolExecutionPage({
  params,
}: {
  params: Promise<{ tenant: string; toolId: string }>
}) {
  const routeParams = use(params)
  const router = useRouter()
  const toolId = routeParams.toolId as string

  const [tool, setTool] = useState<Tool | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [toolParams, setToolParams] = useState<string>("{}")
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    fetchTool()
  }, [toolId])

  const fetchTool = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.get<{ tool: Tool }>(`/ai/user-tools/${toolId}`, token || undefined)
      setTool(response.tool)
    } catch (error) {
      console.error("Error fetching tool:", error)
      alert("Error al cargar la herramienta")
      router.back()
    } finally {
      setIsLoading(false)
    }
  }

  const executeTool = async () => {
    if (!tool) return

    setIsExecuting(true)
    setResult(null)

    try {
      let parsedParams = {}
      try {
        parsedParams = JSON.parse(toolParams)
      } catch (e) {
        alert("Parámetros inválidos. Usa formato JSON.")
        setIsExecuting(false)
        return
      }

      const token = localStorage.getItem("token")
      const response = await api.post<{ result: ExecutionResult }>(
        `/ai/user-tools/${tool.id}/execute`,
        { params: parsedParams },
        token || undefined
      )

      setResult(response.result)
    } catch (error: any) {
      console.error("Error executing tool:", error)
      setResult({
        success: false,
        error: error.message || "Error al ejecutar la herramienta",
      })
    } finally {
      setIsExecuting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Herramienta no encontrada
        </h2>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              tool.isActive
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400"
            }`}>
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tool.name}</h1>
              <p className="text-gray-500 dark:text-gray-400">{tool.description}</p>
            </div>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          tool.isActive
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
        }`}>
          {tool.isActive ? "Activa" : "Inactiva"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel izquierdo: Información y ejecución */}
        <div className="space-y-6">
          {/* Información de la herramienta */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Información</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Creada: {new Date(tool.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Actualizada: {new Date(tool.updatedAt).toLocaleDateString()}</span>
              </div>
              {tool.requiresApproval && (
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Settings className="w-4 h-4" />
                  <span>Requiere aprobación</span>
                </div>
              )}
            </div>
          </div>

          {/* Parámetros de ejecución */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Parámetros</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Ingresa los parámetros en formato JSON
            </p>
            <textarea
              value={toolParams}
              onChange={(e) => setToolParams(e.target.value)}
              placeholder='{ "key": "value" }'
              rows={6}
              className="w-full px-4 py-3 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />

            <button
              onClick={executeTool}
              disabled={isExecuting || !tool.isActive}
              className="w-full mt-4 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg disabled:cursor-not-allowed transition flex items-center justify-center gap-2 font-medium"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Ejecutar
                </>
              )}
            </button>
          </div>

          {/* Resultado */}
          {result && (
            <div className={`rounded-lg border p-5 ${
              result.success
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <h3 className={`font-semibold ${result.success ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
                  {result.success ? "Ejecución exitosa" : "Error en la ejecución"}
                </h3>
              </div>

              {result.durationMs && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Duración: {result.durationMs}ms
                </p>
              )}

              {result.error && (
                <pre className="text-sm text-red-700 dark:text-red-300 overflow-auto bg-red-100 dark:bg-red-900/30 rounded p-3">
                  {result.error}
                </pre>
              )}

              {result.result && (
                <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-auto bg-gray-100 dark:bg-gray-900/50 rounded p-3">
                  {JSON.stringify(result.result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Panel derecho: Código */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Código</h2>
            <button
              onClick={() => setShowCode(!showCode)}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              {showCode ? "Ocultar" : "Ver"}
            </button>
          </div>
          {showCode ? (
            <pre className="p-5 text-sm overflow-auto max-h-[600px] bg-gray-50 dark:bg-gray-900">
              <code>{tool.code}</code>
            </pre>
          ) : (
            <div className="p-12 text-center text-gray-400 dark:text-gray-600">
              <Code2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>El código está oculto por seguridad</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
