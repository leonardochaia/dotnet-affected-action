/**
 * The dotnet-affected major this action version is written against. The arguments
 * built below, and the exit codes read back, are the ones that major documents, so
 * driving a different major is not something this action can claim to do. The action
 * major tracks this number.
 */
export const SUPPORTED_TOOL_MAJOR = 7

/**
 * The default for the `toolVersion` input, kept in sync with action.yml. Without it
 * `dotnet tool install` takes the newest version published, which is not necessarily
 * the major this action targets.
 */
export const DEFAULT_TOOL_VERSION = '7.*'

/**
 * Reads the major out of what `dotnet affected --version` printed, which looks like
 * `6.2.1` or `6.2.1-preview.0.21+b5a80e4`. Returns undefined when the output is not a
 * version, so callers can decide whether an unrecognised format is worth failing over.
 */
export function parseMajorVersion(versionOutput: string): number | undefined {
  const version = versionOutput.trim().split(/\r?\n/).pop()?.trim()
  const major = version?.match(/^(\d+)\./)?.[1]

  return major ? Number(major) : undefined
}

/**
 * Throws when the installed tool is a newer major than this action targets.
 *
 * Older majors are left alone. Pinning one has always been allowed here and this does
 * not take that away.
 */
export function assertSupportedToolVersion(versionOutput: string): void {
  const major = parseMajorVersion(versionOutput)

  if (major === undefined || major <= SUPPORTED_TOOL_MAJOR) {
    return
  }

  throw new Error(
    `dotnet-affected ${versionOutput.trim()} is a newer major than ` +
      `dotnet-affected-action@v${SUPPORTED_TOOL_MAJOR} targets, which is ` +
      `${SUPPORTED_TOOL_MAJOR}.x. Use leonardochaia/dotnet-affected-action@v${major}, ` +
      `or set the toolVersion input to '${DEFAULT_TOOL_VERSION}'.`,
  )
}
