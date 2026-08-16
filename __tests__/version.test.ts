import { expect, test, describe } from '@jest/globals'
import { readFileSync } from 'fs'
import * as path from 'path'
import {
  assertSupportedToolVersion,
  DEFAULT_TOOL_VERSION,
  parseMajorVersion,
  SUPPORTED_TOOL_MAJOR,
} from '../src/version'

describe('parseMajorVersion', () => {
  test('reads a release version', () => {
    expect(parseMajorVersion('6.2.0')).toBe(6)
  })

  test('reads the version dotnet affected --version actually prints', () => {
    expect(
      parseMajorVersion('6.2.1-preview.0.21+b5a80e48e5002f91f8e39409fd5e564c9'),
    ).toBe(6)
  })

  test('reads a two digit major', () => {
    expect(parseMajorVersion('10.0.0')).toBe(10)
  })

  test('ignores anything the tool logged before the version', () => {
    expect(parseMajorVersion('Welcome to .NET!\nTelemetry\n7.0.0\n')).toBe(7)
  })

  test('gives up on output that is not a version', () => {
    expect(parseMajorVersion('command not found')).toBeUndefined()
    expect(parseMajorVersion('')).toBeUndefined()
  })
})

describe('assertSupportedToolVersion', () => {
  test('accepts the supported major', () => {
    expect(() =>
      assertSupportedToolVersion(
        `${SUPPORTED_TOOL_MAJOR}.2.1-preview.0.21+abc`,
      ),
    ).not.toThrow()
  })

  test('accepts earlier majors', () => {
    expect(() => assertSupportedToolVersion('5.0.3')).not.toThrow()
  })

  test('refuses a newer major and names the action to move to', () => {
    expect(() => assertSupportedToolVersion('7.0.0')).toThrow(
      /dotnet-affected-action@v7/,
    )
  })

  test('refuses every major beyond the supported one', () => {
    expect(() => assertSupportedToolVersion('8.1.0')).toThrow()
  })

  // An output format we cannot read is not evidence of an unsupported version, and
  // failing every workflow over it would be worse than the version it guards against.
  test('lets unreadable output through', () => {
    expect(() => assertSupportedToolVersion('command not found')).not.toThrow()
  })
})

test('the default tool version floats within the targeted major', () => {
  expect(DEFAULT_TOOL_VERSION).toBe(`${SUPPORTED_TOOL_MAJOR}.*`)
})

// The input default is what keeps an unsupported major from ever being installed. The
// guard only reports it after the fact.
test('action.yml defaults toolVersion to the same range', () => {
  const action = readFileSync(path.join(__dirname, '..', 'action.yml'), 'utf-8')

  expect(action).toContain(`default: '${DEFAULT_TOOL_VERSION}'`)
})
