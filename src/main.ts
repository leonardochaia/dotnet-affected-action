import * as core from '@actions/core'
import * as os from 'os'
import * as path from 'path'
import { exec } from '@actions/exec'
import { promises as fs } from 'fs'

async function installTool(): Promise<number> {
  const installArgs = ['tool', 'install', '-g', 'dotnet-affected']
  const toolVersion = core.getInput('toolVersion')
  if (toolVersion) {
    installArgs.push('--version', toolVersion)
  }

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

async function run(): Promise<void> {
  try {
    await installTool()

    const args = ['affected', '-f', 'text', 'traversal']

    const fromArg = core.getInput('from')
    const toArg = core.getInput('to')
    const solutionPathArg = core.getInput('solution-path')

    if (fromArg) {
      args.push('--from', fromArg)
    }

    if (toArg) {
      args.push('--to', toArg)
    }

    const affectedTxtPath = process.env.GITHUB_WORKSPACE
    if (!affectedTxtPath) {
      throw new Error('No GITHUB_WORKSPACE env?')
    }

    if (solutionPathArg) {
      args.push('--solution-path', solutionPathArg)
      args.push('--repository-path', affectedTxtPath)
    }

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

    const affectedTxt = await fs.readFile(
      path.join(affectedTxtPath, 'affected.txt'),
      'utf-8'
    )

    core.setOutput('affected', affectedTxt)
  } catch (error: unknown) {
    core.setFailed((error as { message: string }).message)
  }
}

run()
