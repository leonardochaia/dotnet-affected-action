import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import { expect, test } from '@jest/globals'

test('test runs', () => {
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: {
      ...process.env,
      // Only 7.0.0-preview.1 is published, and a NuGet floating range skips
      // prereleases, so the 7.* the action defaults to matches nothing yet.
      // Drop this once 7.0.0 is on NuGet.
      INPUT_TOOLVERSION: '7.*-*',
    },
  }
  console.log(cp.execFileSync(np, [ip], options).toString())
})
