import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./bash.txt"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { Flag } from "@/flag/flag.ts"
import { Truncate } from "./truncation"

const MAX_METADATA_LENGTH = 30_000
const DEFAULT_TIMEOUT = Flag.OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS || 2 * 60 * 1000

export const log = Log.create({ service: "bash-tool" })

// TODO: we may wanna rename this tool so it works better on other shells
export const BashTool = Tool.define("bash", async () => {
  return {
    description: DESCRIPTION.replaceAll("${directory}", Instance.directory)
      .replaceAll("${maxLines}", String(Truncate.MAX_LINES))
      .replaceAll("${maxBytes}", String(Truncate.MAX_BYTES)),
    parameters: z.object({
      command: z.string().describe("The command to execute"),
      timeout: z.number().describe("Optional timeout in milliseconds").optional(),
      workdir: z
        .string()
        .describe(
          `The working directory to run the command in. Defaults to ${Instance.directory}. Use this instead of 'cd' commands.`,
        )
        .optional(),
      description: z
        .string()
        .describe(
          "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
        ),
    }),
    async execute(params, ctx) {
      const cwd = params.workdir || Instance.directory
      if (params.timeout !== undefined && params.timeout < 0) {
        throw new Error(`Invalid timeout value: ${params.timeout}. Timeout must be a positive number.`)
      }
      const timeout = params.timeout ?? DEFAULT_TIMEOUT

      // Request permission
      await ctx.ask({
        permission: "bash",
        patterns: [params.command],
        always: [params.command.split(" ")[0] + " *"],
        metadata: {},
      })

      // Use Bun.spawn instead of child_process.spawn
      const proc = Bun.spawn(params.command, {
        cwd,
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      })

      let output = ""

      // Initialize metadata with empty output
      ctx.metadata({
        metadata: {
          output: "",
          description: params.description,
        },
      })

      const append = (chunk: Buffer) => {
        output += chunk.toString()
        ctx.metadata({
          metadata: {
            // truncate the metadata to avoid GIANT blobs of data (has nothing to do w/ what agent can access)
            output: output.length > MAX_METADATA_LENGTH ? output.slice(0, MAX_METADATA_LENGTH) + "\n\n..." : output,
            description: params.description,
          },
        })
      }

      // Read stdout
      const stdoutReader = proc.stdout.getReader()
      const stderrReader = proc.stderr.getReader()

      let timedOut = false
      let aborted = false

      const timeoutTimer = setTimeout(() => {
        timedOut = true
        proc.kill()
      }, timeout + 100)

      // Read streams
      try {
        while (true) {
          const { done, value } = await stdoutReader.read()
          if (done) break
          append(Buffer.from(value))
        }
      } catch (error) {
        log.error("Error reading stdout:", error)
      }

      try {
        while (true) {
          const { done, value } = await stderrReader.read()
          if (done) break
          append(Buffer.from(value))
        }
      } catch (error) {
        log.error("Error reading stderr:", error)
      }

      // Wait for process to exit
      const exitCode = await proc.exited
      clearTimeout(timeoutTimer)

      const resultMetadata: string[] = []

      if (timedOut) {
        resultMetadata.push(`bash tool terminated command after exceeding timeout ${timeout} ms`)
      }

      if (aborted) {
        resultMetadata.push("User aborted the command")
      }

      if (resultMetadata.length > 0) {
        output += "\n\n<bash_metadata>\n" + resultMetadata.join("\n") + "\n</bash_metadata>"
      }

      return {
        title: params.description,
        metadata: {
          output: output.length > MAX_METADATA_LENGTH ? output.slice(0, MAX_METADATA_LENGTH) + "\n\n..." : output,
          exit: exitCode,
          description: params.description,
        },
        output,
      }
    },
  }
})
