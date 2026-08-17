import { expect, test, describe } from '@jest/globals'
import { readFileSync } from 'fs'
import * as path from 'path'
import { ActionInputs, buildInvocation } from '../src/args'

const noInputs: ActionInputs = {
  repositoryPath: '/workspace',
  from: '',
  to: '',
  uncommitted: '',
  filterFilePath: '',
  solutionPath: '',
  excludeOutput: '',
  exclude: '',
  excludeDiscovery: '',
  noGitIgnore: false,
  outputFormat: '',
}

function build(inputs: Partial<ActionInputs> = {}) {
  return buildInvocation({ ...noInputs, ...inputs })
}

/** The value passed to a flag, or undefined when the flag is not there. */
function valueOf(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)

  return index === -1 ? undefined : args[index + 1]
}

describe('the invocation', () => {
  test('runs the affected command against the workspace', () => {
    const { args } = build()

    expect(args[0]).toBe('affected')
    expect(valueOf(args, '--repository-path')).toBe('/workspace')
  })

  // Left to itself the tool writes next to the filter file. The action reads the output
  // back from the repository path, so the two have to be the same directory.
  test('passes the repository path even when a filter file is given', () => {
    const { args } = build({ filterFilePath: 'src/My.sln' })

    expect(valueOf(args, '--repository-path')).toBe('/workspace')
  })

  test('asks for both default formats, so affected.proj and affected.txt are written', () => {
    const { args, readTextAsOutput } = build()

    expect(args).toContain('--format')
    expect(
      args.slice(args.indexOf('--format') + 1, args.indexOf('--format') + 3),
    ).toEqual(['text', 'traversal'])
    expect(readTextAsOutput).toBe(true)
  })

  test('passes the requested formats instead', () => {
    const { args } = build({ outputFormat: 'text slnf' })

    expect(args.slice(args.indexOf('--format') + 1)).toEqual([
      'text',
      'slnf',
      '--repository-path',
      '/workspace',
      '--uncommitted',
      'all',
    ])
  })

  // A list arriving as one unsplit token reaches the tool as a format name nothing
  // matches, which is what leonardochaia/dotnet-affected-action#322 reported.
  test('splits a format list however it was written', () => {
    for (const outputFormat of [
      'text traversal',
      'text,traversal',
      'text, traversal',
      '  text   traversal  ',
    ]) {
      const { args } = build({ outputFormat })

      expect(
        args.slice(args.indexOf('--format') + 1, args.indexOf('--format') + 3),
      ).toEqual(['text', 'traversal'])
    }
  })

  // The output is read from affected.txt, which only the text format writes. Reading it
  // anyway would fail the run over a file the workflow never asked for.
  test('knows the affected output is unavailable without the text format', () => {
    expect(build({ outputFormat: 'traversal' }).readTextAsOutput).toBe(false)
    expect(build({ outputFormat: 'text json' }).readTextAsOutput).toBe(true)
  })

  // An empty affected output reads exactly like nothing being affected, so the steps
  // conditioned on it skip silently on a run that found plenty.
  test('warns when the formats leave the affected output empty', () => {
    expect(build({ outputFormat: 'traversal' }).warnings).toEqual([
      expect.stringContaining('affected output will be empty'),
    ])
  })

  test('does not warn when text is among the formats', () => {
    expect(build({ outputFormat: 'json text' }).warnings).toEqual([])
    expect(build().warnings).toEqual([])
  })

  test('passes from as the baseline', () => {
    expect(valueOf(build({ from: 'origin/main' }).args, '--from')).toBe(
      'origin/main',
    )
  })

  test('passes the discovery options through', () => {
    const { args } = build({
      filterFilePath: 'My.slnf',
      excludeOutput: '\\.Tests\\.csproj$',
      excludeDiscovery: '/legacy/',
      noGitIgnore: true,
    })

    expect(valueOf(args, '--filter-file-path')).toBe('My.slnf')
    expect(valueOf(args, '--exclude-output')).toBe('\\.Tests\\.csproj$')
    expect(valueOf(args, '--exclude-discovery')).toBe('/legacy/')
    expect(args).toContain('--no-gitignore')
  })

  test('leaves out the options the workflow did not set', () => {
    const { args } = build()

    expect(args).not.toContain('--filter-file-path')
    expect(args).not.toContain('--exclude-output')
    expect(args).not.toContain('--exclude-discovery')
    expect(args).not.toContain('--no-gitignore')
    expect(args).not.toContain('--from')
  })
})

describe('uncommitted changes', () => {
  // Steps before this one restore, generate and stamp files. With a baseline to compare
  // against, none of that should be able to change which projects are reported.
  test('are left out of a comparison that has a baseline', () => {
    expect(valueOf(build({ from: 'origin/main' }).args, '--uncommitted')).toBe(
      'none',
    )
  })

  // --from defaults to the checked out commit, so dropping the working tree as well
  // would compare that commit against itself and report nothing on every run.
  test('are the whole comparison when there is no baseline', () => {
    expect(valueOf(build().args, '--uncommitted')).toBe('all')
  })

  test('are whatever the workflow asked for', () => {
    expect(
      valueOf(
        build({ from: 'origin/main', uncommitted: 'all' }).args,
        '--uncommitted',
      ),
    ).toBe('all')
    expect(
      valueOf(build({ uncommitted: 'staged' }).args, '--uncommitted'),
    ).toBe('staged')
  })
})

describe('the deprecated to input', () => {
  // The tool takes --to only when it names the commit that is checked out, and warns
  // even then. Passing on a stale input would fail runs that have nothing wrong with
  // them.
  test('is never passed to the tool', () => {
    const { args } = build({ from: 'origin/main', to: 'abc123' })

    expect(args).not.toContain('--to')
    expect(args).not.toContain('abc123')
  })

  test('is warned about', () => {
    expect(build({ to: 'abc123' }).warnings).toEqual([
      expect.stringContaining('`to` input is deprecated'),
    ])
  })

  test('is not warned about when unused', () => {
    expect(build({ from: 'origin/main' }).warnings).toEqual([])
  })
})

describe('the deprecated solution-path input', () => {
  test('still selects the filter file', () => {
    const { args, warnings } = build({ solutionPath: 'My.sln' })

    expect(valueOf(args, '--filter-file-path')).toBe('My.sln')
    expect(args).not.toContain('--solution-path')
    expect(warnings).toEqual([
      expect.stringContaining('`solution-path` input is deprecated'),
    ])
  })

  test('loses to filter-file-path, and says so', () => {
    const { args, warnings } = build({
      filterFilePath: 'New.slnf',
      solutionPath: 'Old.sln',
    })

    expect(valueOf(args, '--filter-file-path')).toBe('New.slnf')
    expect(warnings).toEqual([
      expect.stringContaining('`filter-file-path` wins'),
    ])
  })
})

describe('the deprecated exclude input', () => {
  test('still excludes from the output', () => {
    const { args, warnings } = build({ exclude: 'Legacy' })

    expect(valueOf(args, '--exclude-output')).toBe('Legacy')
    expect(args).not.toContain('--exclude')
    expect(warnings).toEqual([
      expect.stringContaining('`exclude` input is deprecated'),
    ])
  })

  test('loses to exclude-output, and says so', () => {
    const { args, warnings } = build({ excludeOutput: 'New', exclude: 'Old' })

    expect(valueOf(args, '--exclude-output')).toBe('New')
    expect(warnings).toEqual([expect.stringContaining('`exclude-output` wins')])
  })
})

// An input the action reads but action.yml does not declare is one no workflow can set:
// Actions only passes through what is declared.
test('every input the action reads is declared in action.yml', () => {
  const action = readFileSync(path.join(__dirname, '..', 'action.yml'), 'utf-8')

  for (const input of [
    'repository-path',
    'from',
    'to',
    'uncommitted',
    'filter-file-path',
    'solution-path',
    'exclude-output',
    'exclude',
    'exclude-discovery',
    'no-gitignore',
    'output-format',
  ]) {
    expect(action).toContain(`  ${input}:`)
  }
})
