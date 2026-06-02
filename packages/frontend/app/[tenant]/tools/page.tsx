/**
 * Tools Page - SP-13: Frontend - Gestión de Herramientas
 *
 * Interfaz para gestionar herramientas personalizadas del usuario
 */

"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Plus, Edit, Trash2, Play, Code2, Settings, Clock, CheckCircle, XCircle } from "lucide-react"

interface Tool {
  id: string
  name: string
  description: string
  code: string
  isActive: boolean
  requiresApproval: boolean
  createdAt: string
  updatedAt: string
  lastExecutedAt?: string
  executionCount?: number
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchTools()
  }, [])

  const fetchTools = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await api.get<{ tools: Tool[] }>("/ai/user-tools", token || undefined)
      setTools(response.tools || [])
    } catch (error) {
      console.error("Error fetching tools:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteTool = async (id: string) => {
    if (!confirm("¿Eliminar esta herramienta?")) return

    try {
      const token = localStorage.getItem("token")
      await api.delete(`/ai/user-tools/${id}`, token || undefined)
      setTools((prev) => prev.filter((t) => t.id !== id))
    } catch (error) {
      console.error("Error deleting tool:", error)
      alert("Error al eliminar la herramienta")
    }
  }

  const toggleToolActive = async (tool: Tool) => {
    try {
      const token = localStorage.getItem("token")
      await api.patch(`/ai/user-tools/${tool.id}`, { isActive: !tool.isActive }, token || undefined)
      setTools((prev) =>
        prev.map((t) => (t.id === tool.id ? { ...t, isActive: !t.isActive } : t))
      )
    } catch (error) {
      console.error("Error toggling tool:", error)
      alert("Error al actualizar la herramienta")
    }
  }

  const filteredTools = tools.filter((tool) =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const ToolCard = ({ tool }: { tool: Tool }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            tool.isActive
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              : "bg-gray-100 dark:bg-gray-700 text-gray-400"
          }`}>
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{tool.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tool.description}</p>
          </div>
        </div>
        <button
          onClick={() => toggleToolActive(tool)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            tool.isActive ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              tool.isActive ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Creada: {new Date(tool.createdAt).toLocaleDateString()}</span>
        </div>
        {tool.lastExecutedAt && (
          <div className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            <span>Ejecutada: {new Date(tool.lastExecutedAt).toLocaleDateString()}</span>
          </div>
        )}
        {tool.executionCount !== undefined && tool.executionCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-medium">{tool.executionCount}x</span>
          </div>
        )}
        {tool.requiresApproval && (
          <div className="flex items-center gap-1 text-orange-500">
            <Settings className="w-3 h-3" />
            <span>Requiere aprobación</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setSelectedTool(tool)
            setShowEditModal(true)
          }}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex items-center justify-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Editar
        </button>
        <button
          onClick={() => deleteTool(tool.id)}
          className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mis Herramientas</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Crea herramientas personalizadas para automatizar tareas
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium"
        >
          <Plus className="w-5 h-5" />
          Nueva herramienta
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar herramientas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Tools Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <Code2 className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {searchQuery ? "No se encontraron herramientas" : "No tienes herramientas personalizadas"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchQuery
              ? "Intenta con otros términos de búsqueda"
              : "Crea tu primera herramienta para automatizar tareas repetitivas"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-medium"
            >
              <Plus className="w-5 h-5" />
              Crear herramienta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ToolCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newTool) => {
            setTools((prev) => [...prev, newTool])
            setShowCreateModal(false)
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTool && (
        <ToolEditModal
          tool={selectedTool}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTool(null)
          }}
          onUpdated={(updatedTool) => {
            setTools((prev) => prev.map((t) => (t.id === updatedTool.id ? updatedTool : t)))
            setShowEditModal(false)
            setSelectedTool(null)
          }}
        />
      )}
    </div>
  )
}

// ============================================
// Create Tool Modal
// ============================================

function ToolCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (tool: Tool) => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [code, setCode] = useState("")
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !code.trim()) {
      alert("Nombre y código son requeridos")
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem("token")
      const response = await api.post<{ tool: Tool }>("/ai/user-tools", {
        name: name.trim(),
        description: description.trim(),
        code: code.trim(),
        requiresApproval,
      }, token || undefined)

      onCreated(response.tool)
    } catch (error) {
      console.error("Error creating tool:", error)
      alert("Error al crear la herramienta")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Nueva Herramienta</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej: consultar_stock_db"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe qué hace esta herramienta..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Código JavaScript *
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`// Ejemplo:
async function execute(params, context) {
  // params: parámetros recibidos
  // context: { tenantId, workspacePath, userId }

  return {
    success: true,
    result: "..."
  }
}`}
              rows={10}
              className="w-full px-4 py-2 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresApproval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="requiresApproval" className="text-sm text-gray-700 dark:text-gray-300">
              Requiere aprobación antes de ejecutar
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Crear
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// Edit Tool Modal
// ============================================

function ToolEditModal({ tool, onClose, onUpdated }: {
  tool: Tool
  onClose: () => void
  onUpdated: (tool: Tool) => void
}) {
  const [name, setName] = useState(tool.name)
  const [description, setDescription] = useState(tool.description)
  const [code, setCode] = useState(tool.code)
  const [requiresApproval, setRequiresApproval] = useState(tool.requiresApproval || false)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !code.trim()) {
      alert("Nombre y código son requeridos")
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem("token")
      const response = await api.patch<{ tool: Tool }>(`/ai/user-tools/${tool.id}`, {
        name: name.trim(),
        description: description.trim(),
        code: code.trim(),
        requiresApproval,
      }, token || undefined)

      onUpdated(response.tool)
    } catch (error) {
      console.error("Error updating tool:", error)
      alert("Error al actualizar la herramienta")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Editar Herramienta</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Código JavaScript *
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={10}
              className="w-full px-4 py-2 font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresApproval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="requiresApproval" className="text-sm text-gray-700 dark:text-gray-300">
              Requiere aprobación antes de ejecutar
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
