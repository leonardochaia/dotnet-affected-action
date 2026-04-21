import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as os from 'os'
import { expect, test } from '@jest/globals'

test('test runs', () => {
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.SpawnSyncOptions = {
    env: {
      ...process.env,
      GITHUB_WORKSPACE: process.env.GITHUB_WORKSPACE ?? os.tmpdir(),
    },
    encoding: 'utf-8',
    timeout: 30000,
  }
  const result = cp.spawnSync(np, [ip], options)
  expect(result.error).toBeUndefined()
})
