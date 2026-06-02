/**
 * Integration Adapter Factory
 *
 * Dado un tipo de integracion y su config, devuelve el adapter correcto.
 */

import { type IntegrationAdapter, type IntegrationConfig } from "./base-integration.adapter"
import { DolibarrAdapter } from "./dolibarr.adapter"
import { GenericAPIAdapter } from "./generic-api.adapter"
import { createLogger } from "../../../utils/logger"

const logger = createLogger("integration-adapter-factory")

// Cache de adapters por tenant+integration (reutilizar conexiones)
const adapterCache = new Map<string, IntegrationAdapter>()

export function createIntegrationAdapter(
  integrationType: string,
  config: IntegrationConfig,
): IntegrationAdapter {
  const cacheKey = `${integrationType}:${config.baseUrl}:${JSON.stringify(config.credentials)}`

  const cached = adapterCache.get(cacheKey)
  if (cached) return cached

  let adapter: IntegrationAdapter

  switch (integrationType.toLowerCase()) {
    case "erp":
    case "dolibarr":
      adapter = new DolibarrAdapter(config)
      break

    case "custom_api":
    case "generic-api":
    case "generic":
      adapter = new GenericAPIAdapter(config)
      break

    default:
      // Default: intentar como generic API
      logger.warn(`Unknown integration type "${integrationType}", using generic adapter`)
      adapter = new GenericAPIAdapter(config)
  }

  adapterCache.set(cacheKey, adapter)
  return adapter
}

/**
 * Limpia el cache de adapters
 */
export function clearAdapterCache(integrationId?: string) {
  if (integrationId) {
    for (const [key] of adapterCache) {
      if (key.includes(integrationId)) {
        adapterCache.delete(key)
      }
    }
  } else {
    adapterCache.clear()
  }
}
