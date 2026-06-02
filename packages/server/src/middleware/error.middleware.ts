// Error handling middleware
import { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { ZodError } from "zod"
import { logger } from "../utils/logger"
import { env } from "../config/env"

export async function errorHandler(err: Error, c: Context) {
  // Log the error
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })

  // Handle specific error types
  if (err instanceof HTTPException) {
    return c.json(
      {
      error: err.message,
        code: err.status,
      },
      err.status
    )
  }

  if (err instanceof ZodError) {
    return c.json(
      {
      error: "Validation error",
        code: 400,
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
      400
    )
  }

  // Generic error
  const status = 500
  const message =
    env.NODE_ENV === "production" ? "Internal server error" : err.message

  return c.json(
    {
      error: message,
      code: status,
    },
    status
  )
}
