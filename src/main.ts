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

    // if (Inputs.path) {
    //   args.push('-p', Inputs.path)
    // }

    core.info('Running dotnet affected')
    let affectedStdOut = ''
    await exec('dotnet', args, {
      listeners: {
        stdout: (data: Buffer) => {
          affectedStdOut += data.toString()
        },
        stderr: (data: Buffer) => {
          console.error(data.toString())
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

    // // Break up the JSON into individual outputs.
    // const versionProperties = JSON.parse(affectedStdOut)
    // for (const name in versionProperties.CloudBuildAllVars) {
    //   // Trim off the leading NBGV_
    //   core.setOutput(
    //     name.substring(5),
    //     versionProperties.CloudBuildAllVars[name]
    //   )
    // }

    // // Set environment variables if desired.
    // if (Inputs.setCommonVars || Inputs.setAllVars) {
    //   args = ['cloud']
    //   if (Inputs.path) {
    //     args.push('-p', Inputs.path)
    //   }
    //   if (Inputs.setCommonVars) {
    //     args.push('-c')
    //   }
    //   if (Inputs.setAllVars) {
    //     args.push('-a')
    //   }

    //   await exec('nbgv', args)
    // }

    // // Stamp the version on an existing file, if desired.
    // if (Inputs.stamp) {
    //   if (path.basename(Inputs.stamp) === 'package.json') {
    //     await exec(
    //       'npm',
    //       [
    //         'version',
    //         versionProperties.NpmPackageVersion,
    //         '--git-tag-version=false',
    //         '--allow-same-version',
    //       ],
    //       { cwd: path.dirname(Inputs.stamp) }
    //     )
    //   } else {
    //     throw new Error(
    //       `Unable to stamp unsupported file format: ${path.basename(
    //         Inputs.stamp
    //       )}`
    //     )
    //   }
    // }
  } catch (error: unknown) {
    console.error(error);
    core.setFailed((error as { message: string }).message)
  }
}

run()
