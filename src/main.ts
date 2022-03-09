import * as core from '@actions/core'
import * as os from 'os'
import * as path from 'path'
import { exec } from '@actions/exec'
import { promises as fs } from 'fs'

async function run(): Promise<void> {
  try {
    // install dotnet-affected
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

    // Collect a JSON string of all the version properties.
    const args = ['affected', '-f', 'text']

    const fromArg = core.getInput('from')
    const toArg = core.getInput('to')

    if (fromArg) {
      args.push('--from', fromArg)
    }

    if (toArg) {
      args.push('--to', toArg)
    }

    core.info(`Running dotnet affected ${args.join('')}`)

    let affectedStdOut = ''
    await exec('dotnet', args, {
      listeners: {
        stdout: (data: Buffer) => {
          affectedStdOut += data.toString()
        },
      },
    })

    core.info(affectedStdOut)

    const affectedTxtPath = process.env.GITHUB_WORKSPACE
    if (!affectedTxtPath) {
      throw new Error('No GITHUB_WORKSPACE env?')
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
