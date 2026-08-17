/**
 * Translates the action's inputs into a `dotnet affected` invocation.
 *
 * Kept apart from the step that runs it so the mapping can be tested on its own:
 * it is the whole contract between this action and the tool's major.
 */

/** The inputs, already read off the workflow. */
export interface ActionInputs {
  repositoryPath: string
  from: string
  to: string
  uncommitted: string
  filterFilePath: string
  solutionPath: string
  excludeOutput: string
  exclude: string
  excludeDiscovery: string
  noGitIgnore: boolean
  outputFormat: string
}

export interface AffectedInvocation {
  /** Arguments for `dotnet`, starting with `affected`. */
  args: string[]
  /** Messages to surface before running, one per deprecated input in use. */
  warnings: string[]
  /**
   * Whether `affected.txt` will be written, and with it the `affected` output.
   * False whenever the requested formats leave `text` out.
   */
  readTextAsOutput: boolean
}

/** What the action asks for when `output-format` is not set. */
export const DEFAULT_OUTPUT_FORMATS = ['text', 'traversal']

export function buildInvocation(inputs: ActionInputs): AffectedInvocation {
  const args = ['affected']
  const warnings: string[] = []

  // Documented as space separated, but a list is a list: commas are what people reach
  // for, and a whole list arriving as one unsplit token reaches the tool as a format
  // name nothing matches.
  const formats = inputs.outputFormat
    ? inputs.outputFormat.split(/[\s,]+/).filter(format => format)
    : DEFAULT_OUTPUT_FORMATS

  args.push('--format', ...formats)

  // The affected output is read from affected.txt, which only the text format writes.
  // Without it the output is empty on every run, which reads exactly like nothing being
  // affected: the `outputs.affected != ''` conditions this action exists to drive would
  // skip every step, on a run that succeeded and found plenty.
  if (!formats.includes('text')) {
    warnings.push(
      `The output-format input does not include 'text', so the affected output will be ` +
        `empty on every run: it is read from affected.txt, which only that format writes. ` +
        `Steps conditioned on it will be skipped even when projects were affected. Add ` +
        `'text' to output-format, or condition those steps on something else.`,
    )
  }

  // Always passed, so the output lands where this action reads it back from. Left to
  // itself the tool writes next to the filter file, which for a solution in a
  // subdirectory is not the workspace.
  args.push('--repository-path', inputs.repositoryPath)

  if (inputs.from) {
    args.push('--from', inputs.from)
  }

  // The tool takes --to only when it names the commit that is checked out, which makes
  // it a no-op, and warns even then. Actions checks out the commit being built, so the
  // input has nothing left to express. Passing it on would turn a stale workflow input
  // into a failed run for no gain.
  if (inputs.to) {
    warnings.push(
      'The `to` input is deprecated and is being ignored. dotnet-affected 7 ends every ' +
        'comparison at the working tree, which Actions has already checked out at the ' +
        'commit being built. Remove the input, and use `uncommitted` to choose what an ' +
        'unclean working tree contributes.',
    )
  }

  args.push('--uncommitted', inputs.uncommitted || defaultUncommitted(inputs))

  const filterFilePath = inputs.filterFilePath || inputs.solutionPath
  if (inputs.solutionPath) {
    warnings.push(
      inputs.filterFilePath
        ? 'Both `filter-file-path` and `solution-path` are set. `filter-file-path` wins; ' +
            'remove `solution-path`, which is deprecated.'
        : 'The `solution-path` input is deprecated, use `filter-file-path`. It takes the ' +
            'same solution files and also accepts .slnx and .slnf.',
    )
  }

  if (filterFilePath) {
    args.push('--filter-file-path', filterFilePath)
  }

  const excludeOutput = inputs.excludeOutput || inputs.exclude
  if (inputs.exclude) {
    warnings.push(
      inputs.excludeOutput
        ? 'Both `exclude-output` and `exclude` are set. `exclude-output` wins; remove ' +
            '`exclude`, which is deprecated.'
        : 'The `exclude` input is deprecated, use `exclude-output`. It does the same thing: ' +
            'matching projects are still evaluated and still carry changes to the projects ' +
            'depending on them, they are only kept out of the output.',
    )
  }

  if (excludeOutput) {
    args.push('--exclude-output', excludeOutput)
  }

  if (inputs.excludeDiscovery) {
    args.push('--exclude-discovery', inputs.excludeDiscovery)
  }

  if (inputs.noGitIgnore) {
    args.push('--no-gitignore')
  }

  return {
    args,
    warnings,
    readTextAsOutput: formats.includes('text'),
  }
}

/**
 * What the working tree contributes when the workflow did not say.
 *
 * The tool defaults to `all`, which is right for a developer running it on a checkout
 * they are editing. A job is not that: steps before this one restore, generate and
 * stamp files, and every one of those writes would count as a change. So with a
 * baseline to compare against, the default here is the commits alone.
 *
 * Without a baseline there is nothing else to compare: `--from` defaults to the
 * checked-out commit, so ignoring the working tree too would leave the two ends of the
 * comparison identical and report nothing affected on every run.
 */
function defaultUncommitted(inputs: ActionInputs): string {
  return inputs.from ? 'none' : 'all'
}
