import * as core from '@actions/core'
import * as os from 'os'
import * as path from 'path'
import { exec } from '@actions/exec'
import { promises as fs } from 'fs'
import { assertSupportedToolVersion, DEFAULT_TOOL_VERSION } from './version'
import { ActionInputs, buildInvocation } from './args'

async function installTool(): Promise<number> {
  const installArgs = ['tool', 'install', '-g', 'dotnet-affected']
  const toolVersion = core.getInput('toolVersion') || DEFAULT_TOOL_VERSION
  installArgs.push('--version', toolVersion)

  const exitCode = await exec('dotnet', installArgs, {
    ignoreReturnCode: true,
  })

  if (exitCode > 1) {
    throw new Error('Failed to install dotnet affected tool')
  }

  // add .dotnet/tools to the path
  core.addPath(path.join(os.homedir(), '.dotnet', 'tools'))
  return exitCode
}

/**
 * The tool that ends up on the path is not necessarily the one this run asked for:
 * toolVersion is free form NuGet range syntax, and an install that finds the tool
 * already there exits non zero and is tolerated. Ask the tool itself.
 */
async function assertInstalledToolIsSupported(): Promise<void> {
  let version = ''

  // A version that cannot be read is not evidence of an unsupported one, and this
  // check must not be what breaks a run that would otherwise have worked. Whatever
  // stopped it reporting a version stops the invocation below too, with a better
  // message than this could give.
  const exitCode = await exec('dotnet', ['affected', '--version'], {
    listeners: {
      stdout: (data: Buffer) => {
        version += data.toString()
      },
    },
    silent: true,
    ignoreReturnCode: true,
  })

  if (exitCode === 0) {
    assertSupportedToolVersion(version)
  }
}

/**
 * `core.getBooleanInput` throws on an input that is not there, which for an optional
 * one is just its absence. Only a value that is present and not a boolean is an error
 * worth reporting.
 */
function getOptionalBooleanInput(name: string): boolean {
  return core.getInput(name) ? core.getBooleanInput(name) : false
}

function readInputs(): ActionInputs {
  // The repository this job checked out, and where the output is read back from.
  const repositoryPath =
    core.getInput('repository-path') || process.env.GITHUB_WORKSPACE

  if (!repositoryPath) {
    throw new Error(
      'No GITHUB_WORKSPACE env? Set the repository-path input to the checkout to analyse.',
    )
  }

  return {
    repositoryPath,
    from: core.getInput('from'),
    to: core.getInput('to'),
    uncommitted: core.getInput('uncommitted'),
    filterFilePath: core.getInput('filter-file-path'),
    solutionPath: core.getInput('solution-path'),
    excludeOutput: core.getInput('exclude-output'),
    exclude: core.getInput('exclude'),
    excludeDiscovery: core.getInput('exclude-discovery'),
    noGitIgnore: getOptionalBooleanInput('no-gitignore'),
    outputFormat: core.getInput('output-format'),
  }
}

async function run(): Promise<void> {
  try {
    const inputs = readInputs()
    const { args, warnings, readTextAsOutput } = buildInvocation(inputs)

    // Before installing anything: a workflow that is about to be told its inputs are
    // going away should hear it even if the run then fails for another reason.
    for (const warning of warnings) {
      core.warning(warning)
    }

    await installTool()
    await assertInstalledToolIsSupported()

    core.info(`Running dotnet affected`)

    let affectedStdErr = ''
    const affectedExitCode = await exec('dotnet', args, {
      listeners: {
        stderr: (data: Buffer) => {
          affectedStdErr += data.toString()
        },
      },
      ignoreReturnCode: true,
      failOnStdErr: false,
    })

    if (affectedExitCode === 166) {
      // No affected projects. Stdout will log it
      return
    } else if (affectedExitCode > 0) {
      core.error(affectedStdErr)
      core.setFailed('dotnet affected failed!')
      return
    }

    if (readTextAsOutput) {
      const affectedTxt = await fs.readFile(
        path.join(inputs.repositoryPath, 'affected.txt'),
        'utf-8',
      )
      core.setOutput('affected', affectedTxt)
    }
  } catch (error: unknown) {
    core.setFailed((error as { message: string }).message)
  }
}

run()
