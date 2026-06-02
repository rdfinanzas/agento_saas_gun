/**
 * Dolibarr ERP Adapter
 *
 * Portado de bot2/whatsapp-bot/src/adapters/dolibarr-adapter.js
 * Se comunica con la REST API de Dolibarr para productos, clientes, pedidos.
 */

import axios, { type AxiosInstance } from "axios"
import { z } from "zod"
import { BaseIntegrationAdapter, type IntegrationConfig, type ToolContext, type ToolDefinition } from "./base-integration.adapter"
import { createLogger } from "../../../utils/logger"

const logger = createLogger("dolibarr-adapter")

// ─── ADAPTER ──────────────────────────────────────────────────

export class DolibarrAdapter extends BaseIntegrationAdapter {
  readonly type = "dolibarr"
  private client: AxiosInstance

  constructor(config: IntegrationConfig) {
    super(config)
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        DOLAPIKEY: this.credentials.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    })
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { status } = await this.client.get("/api/status")
      if (status === 200) {
        // Verificar que la API key funciona
        const { data } = await this.client.get("/api/products", { params: { limit: 1 } })
        return { success: true, message: "Conexion exitosa con Dolibarr" }
      }
      return { success: false, message: `Status inesperado: ${status}` }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.status === 401
          ? "API key invalida"
          : `Error de conexion: ${error.message}`,
      }
    }
  }

  // ─── METODOS INTERNOS ─────────────────────────────────────

  private async searchProducts(query: string, options?: { limit?: number }): Promise<DolibarrProduct[]> {
    const { data } = await this.client.get("/api/products", {
      params: {
        sortfield: "t.ref",
        sortorder: "ASC",
        limit: options?.limit || 50,
        sqlfilters: `(t.ref:like:'%${query}%') OR (t.label:like:'%${query}%')`,
      },
    })
    return data
  }

  private async getProduct(productId: number): Promise<DolibarrProduct> {
    const { data } = await this.client.get(`/api/products/${productId}`)
    return data
  }

  private async getProductStock(productId: number): Promise<DolibarrStock> {
    const { data } = await this.client.get(`/api/products/${productId}/stock`)
    return data
  }

  private async findCustomer(phone: string): Promise<DolibarrThirdparty | null> {
    const cleanPhone = phone.replace(/[^0-9+]/g, "")
    try {
      const { data } = await this.client.get("/api/thirdparties", {
        params: {
          sortfield: "t.rowid",
          sortorder: "ASC",
          sqlfilters: `(t.phone:like:'%${cleanPhone}%')`,
        },
      })
      return Array.isArray(data) && data.length > 0 ? data[0] : null
    } catch {
      return null
    }
  }

  private async createCustomer(customerData: { name: string; phone: string; address?: string; email?: string }): Promise<DolibarrThirdparty> {
    const { data } = await this.client.post("/api/thirdparties", {
      name: customerData.name,
      phone: customerData.phone,
      address: customerData.address || "",
      email: customerData.email || "",
      client: 1,
    })
    return data
  }

  private async createOrder(lines: Array<{ productId: number; qty: number; price: number }>, customerId: number): Promise<{ orderId: string }> {
    const orderLines = lines.map((line, i) => ({
      fk_product: line.productId,
      qty: line.qty,
      subprice: line.price,
      tva_tx: 21,
      product_type: 0,
      rang: i + 1,
    }))

    const { data } = await this.client.post("/api/orders", {
      socid: customerId,
      lines: orderLines,
    })

    return { orderId: String(data) }
  }

  private async refreshCartPrices(items: Array<{ productId: number; qty: number; unitPrice: number }>): Promise<Array<{
    productId: number
    productName: string
    oldPrice: number
    newPrice: number
    changed: boolean
    inStock: boolean
    stockAvailable: number
    error?: string
  }>> {
    const results = []

    for (const item of items) {
      try {
        const product = await this.getProduct(item.productId)
        const newPrice = product.price_ttc || product.price
        results.push({
          productId: item.productId,
          productName: product.label || product.ref,
          oldPrice: item.unitPrice,
          newPrice,
          changed: Math.abs(newPrice - item.unitPrice) > 0.01,
          inStock: (product.stock || 0) >= item.qty,
          stockAvailable: product.stock || 0,
        })
      } catch (error: any) {
        results.push({
          productId: item.productId,
          productName: `Producto #${item.productId}`,
          oldPrice: item.unitPrice,
          newPrice: item.unitPrice,
          changed: false,
          inStock: false,
          stockAvailable: 0,
          error: error.message,
        })
      }
    }

    return results
  }

  // ─── TOOLS PARA EL AGENTE ────────────────────────────────

  getTools(context: ToolContext): ToolDefinition[] {
    return [
      {
        name: "searchProducts",
        description: "Buscar productos en el catalogo. Usar cuando el cliente pregunta por productos, precios o disponibilidad.",
        parameters: z.object({
          query: z.string().describe("Nombre, referencia o keyword del producto"),
        }),
        execute: async ({ query }) => {
          try {
            const products = await this.searchProducts(query, { limit: 50 })
            if (!products || products.length === 0) return "No encontre productos para tu busqueda."

            const available = products.filter((p: any) => (p.price_ttc || p.price) > 0 && p.tosell !== "0")
            if (available.length === 0) return "No encontre productos disponibles."

            // Agrupar por nombre
            const grouped = new Map<string, any[]>()
            for (const p of available) {
              const key = p.label || p.ref
              if (!grouped.has(key)) grouped.set(key, [])
              grouped.get(key)!.push(p)
            }

            let response = `Encontre ${grouped.size} producto(s):\n\n`
            let count = 0
            for (const [label, variants] of grouped) {
              if (count >= 15) break
              variants.sort((a: any, b: any) => (a.price_ttc || a.price) - (b.price_ttc || b.price))
              const cheapest = variants[0]
              const price = cheapest.price_ttc || cheapest.price
              response += `${count + 1}. [ID:${cheapest.id}] ${label}\n`
              response += `   Precio: $${Number(price).toFixed(2)} | ${(cheapest.stock || 0) > 0 ? "Disponible" : "Sin stock"}\n`
              count++
            }

            if (grouped.size > 15) response += `\nHay mas resultados. Pedime filtrar por marca o precio.`
            return response
          } catch (error: any) {
            return `Error buscando productos: ${error.message}`
          }
        },
      },

      {
        name: "getProductDetails",
        description: "Obtener informacion detallada de un producto: descripcion, precio, stock.",
        parameters: z.object({
          productId: z.number().describe("ID del producto"),
        }),
        execute: async ({ productId }) => {
          try {
            const product = await this.getProduct(productId)
            let response = `Producto: ${product.label || product.ref}\n`
            response += `ID: ${product.id}\n`
            response += `Ref: ${product.ref}\n`
            const price = product.price_ttc || product.price
            response += `Precio: $${Number(price).toFixed(2)}\n`
            response += `Stock: ${(product.stock || 0) > 0 ? product.stock + " unidades" : "Sin stock"}\n`
            if (product.description) {
              const clean = product.description.replace(/<[^>]*>/g, "").substring(0, 300)
              if (clean.trim()) response += `Descripcion: ${clean}\n`
            }
            return response
          } catch (error: any) {
            return `Error: ${error.message}`
          }
        },
      },

      {
        name: "checkStock",
        description: "Consultar stock detallado de un producto.",
        parameters: z.object({
          productId: z.number().describe("ID del producto"),
        }),
        execute: async ({ productId }) => {
          try {
            const stock = await this.getProductStock(productId)
            let response = `Stock producto #${productId}:\n`
            response += `Real: ${stock.stock_real ?? stock.reel}\n`
            response += `Virtual: ${stock.stock_virtual}\n`
            return response
          } catch (error: any) {
            return `Error: ${error.message}`
          }
        },
      },

      {
        name: "findCustomer",
        description: "Buscar un cliente por telefono. Retorna nombre, direccion y ID si existe.",
        parameters: z.object({
          phone: z.string().describe("Numero de telefono"),
        }),
        execute: async ({ phone }) => {
          try {
            const customer = await this.findCustomer(phone)
            if (!customer) return "Cliente no encontrado."
            let response = `Cliente encontrado:\n`
            response += `ID: ${customer.id}\n`
            response += `Nombre: ${customer.name}\n`
            response += `Telefono: ${customer.phone || "N/A"}\n`
            if (customer.address) response += `Direccion: ${customer.address}\n`
            if (customer.email) response += `Email: ${customer.email}\n`
            return response
          } catch (error: any) {
            return `Error: ${error.message}`
          }
        },
      },

      {
        name: "createCustomer",
        description: "Crear un nuevo cliente en el sistema.",
        parameters: z.object({
          name: z.string().describe("Nombre del cliente"),
          phone: z.string().describe("Telefono"),
          address: z.string().optional().describe("Direccion"),
          email: z.string().optional().describe("Email"),
        }),
        execute: async (params) => {
          try {
            const customer = await this.createCustomer(params)
            return `Cliente creado exitosamente. ID: ${customer.id || customer}. Nombre: ${params.name}.`
          } catch (error: any) {
            return `Error creando cliente: ${error.message}`
          }
        },
      },

      {
        name: "createOrder",
        description: "Crear un pedido en el ERP.",
        parameters: z.object({
          customerId: z.number().describe("ID del cliente"),
          items: z.array(z.object({
            productId: z.number(),
            qty: z.number(),
            price: z.number(),
          })).describe("Items del pedido"),
        }),
        execute: async ({ customerId, items }) => {
          try {
            const result = await this.createOrder(items, customerId)
            return `Pedido creado exitosamente. ID: ${result.orderId}. Total de items: ${items.length}.`
          } catch (error: any) {
            return `Error creando pedido: ${error.message}`
          }
        },
      },
    ]
  }
}

// ─── TIPOS DOLIBARR ───────────────────────────────────────────

interface DolibarrProduct {
  id: string | number
  ref: string
  label: string
  description?: string
  price: number
  price_ttc?: number
  vat_rate?: number
  stock?: number
  tosell?: string | number
  barcode?: string
}

interface DolibarrStock {
  productId?: number
  stock_real?: number
  stock_virtual?: number
  reel?: number
  warehouses?: Array<{ id: string | number; label?: string; real: number }>
}

interface DolibarrThirdparty {
  id: string | number
  name: string
  phone?: string
  address?: string
  email?: string
}
