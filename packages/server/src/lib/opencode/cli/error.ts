/**
 * CLI Error Stub
 * 
 * CLI errors - disabled for server environment
 */

export class FormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FormatError"
  }
}
