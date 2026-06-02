/**
 * glob - Tool to search files by pattern
 *
 * Adapted for AgenTo SaaS - validates paths within workspace
 */

import * as path from "path"
import { glob as globFn } from "glob"
import { ToolContext, ToolResult, PathValidator } from "../types/tool-context"

export interface GlobParams {
  /** Glob pattern to search for files */
  pattern: string
  /** Base directory for search (default: workspace) */
  cwd?: string
  /** Results limit (default: 100) */
  limit?: number
}

const DEFAULT_LIMIT = 100

export const glob = {
  name: "glob",
  description:
    "Search files using glob patterns. " +
    "Examples: '**/*.ts' searches all TypeScript files, 'src/**/*.js' searches JS in src. " +
    "Use cwd to specify the base directory.",

  async execute(params: GlobParams, context: ToolContext): Promise<ToolResult> {
    // Validate pattern
    if (!params.pattern || params.pattern.trim().length === 0) {
      throw new Error("pattern is required")
    }

    // Validate cwd
    const searchPath = params.cwd
      ? PathValidator.resolve(context.workspacePath, params.cwd)
      : context.workspacePath

    PathValidator.validate(context.workspacePath, searchPath)

    // Request permission
    if (context.askPermission) {
      const response = await context.askPermission({
        permission: "glob",
        patterns: [params.pattern],
        always: ["*"],
        metadata: {
          pattern: params.pattern,
          path: PathValidator.relative(context.workspacePath, searchPath),
        },
      })
      if (!response.granted) {
        throw new Error(response.reason || "Permission denied")
      }
    }

    const limit = params.limit ?? DEFAULT_LIMIT

    try {
      // Execute glob search
      const files = await globFn(params.pattern, {
        cwd: searchPath,
        absolute: false,
        dot: true,
        nodir: true,
        maxDepth: 20, // Limit depth
      })

      // Ensure we have an array (glob package returns GlobStream if withFileTypes is false)
      let filesArray: string[]
      if (Array.isArray(files)) {
        filesArray = files
      } else {
        // Convert async iterable to array
        filesArray = []
        const iterator = (files as any)[Symbol.iterator]
        if (typeof iterator === 'function') {
          // Sync iterator
          for (const file of files as any) {
            filesArray.push(file)
          }
        } else if (typeof files === 'object' && files !== null) {
          // Try async iteration
          const asyncIterator = (files as any)[Symbol.asyncIterator]
          if (typeof asyncIterator === 'function') {
            for await (const file of files as AsyncIterable<string>) {
              filesArray.push(file)
            }
          }
        }
      }

      // Sort by name
      filesArray.sort()

      // Apply limit
      const truncated = filesArray.length > limit
      const results = truncated ? filesArray.slice(0, limit) : filesArray

      // Build output
      const output: string[] = []
      if (results.length === 0) {
        output.push("No files found")
      } else {
        output.push(...results)
        if (truncated) {
          output.push("")
          output.push(
            `(Results truncated: showing first ${limit} of ${filesArray.length} results. ` +
            `Consider using a more specific pattern or path.)`
          )
        }
      }

      return {
        title: PathValidator.relative(context.workspacePath, searchPath),
        output: output.join("\n"),
        metadata: {
          count: filesArray.length,
          truncated,
          pattern: params.pattern,
        },
      }
    } catch (error) {
      throw new Error(`Glob search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}
