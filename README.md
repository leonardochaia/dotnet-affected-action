<p align="center">
  <a href="https://github.com/leonardochaia/dotnet-affected-action/actions/workflows/test.yml"><img alt="build-test status" src="https://github.com/leonardochaia/dotnet-affected-action/actions/workflows/test.yml/badge.svg"></a>
</p>

# Run dotnet-affected inside GitHub actions

dotnet-affected is a .NET tool for determining which projects are affected by a set of changes. Useful for large projects or monorepos.

Read more at <https://github.com/leonardochaia/dotnet-affected>

## Versioning

The action major tracks the dotnet-affected major it is written against. `@v7` targets dotnet-affected 7.x, so it installs the latest 7.x by default and fails if a newer major is on the path.

`@v1` targets dotnet-affected 6.x. It is deprecated, `v1.5` is its last release, and every run logs a warning. See [Upgrading](#upgrading-from-v1) below.

Set `toolVersion` to pin a specific version:

```yaml
- uses: leonardochaia/dotnet-affected-action@v7
  with:
    toolVersion: '7.0.0'
```

## Usage

This action will run dotnet affected and output an `affected.proj` file that you can use to build/test/publish what has changed/affected since the last successful commit, or against your main branch, etc.

### For building branches

```yaml
name: .NET
on:
  push:
    branches:
      - main
    tags:
      - 'v*'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup .NET Core SDK
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'

      - uses: nrwl/nx-set-shas@v4
        id: set_shas

      - uses: leonardochaia/dotnet-affected-action@v7
        id: dotnet_affected
        with:
          from: ${{ steps.set_shas.outputs.base }}

      - name: Install dependencies
        if: success() && steps.dotnet_affected.outputs.affected != ''
        run: dotnet restore affected.proj
      - name: Build
        if: success() && steps.dotnet_affected.outputs.affected != ''
        run: dotnet build --configuration Release --no-restore affected.proj
      - name: Test
        if: success() && steps.dotnet_affected.outputs.affected != ''
        run: dotnet test --no-restore --verbosity normal affected.proj
```

### For building PRs

```yaml
name: .NET
on:
  pull_request:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup .NET Core SDK
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'

      - uses: leonardochaia/dotnet-affected-action@v7
        id: dotnet_affected
        with:
          from: origin/${{ github.base_ref }}

      - name: Install dependencies
        if: success() && steps.dotnet_affected.outputs.affected != ''
        run: dotnet restore affected.proj
      - name: Build
        if: success() && steps.dotnet_affected.outputs.affected != ''
        run: dotnet build --configuration Release --no-restore affected.proj
      - name: Test
        if: success() && steps.dotnet_affected.outputs.affected != ''
        run: dotnet test --no-restore --verbosity normal affected.proj
```

`fetch-depth: 0` is not optional: the default shallow clone has neither the baseline nor a merge base.

## Inputs

Every input is optional. With none of them set, the action compares the checked-out commit against the working tree.

| Input               | Maps to                         | Description                                                                                        |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `toolVersion`       | `dotnet tool install --version` | dotnet-affected version to install. NuGet range syntax. Defaults to `7.*`, the major this action targets |
| `repository-path`   | `--repository-path`             | The checkout to analyse. Defaults to the workspace. Output files are written here                     |
| `from`              | `--from`                        | The baseline to compare against. Defaults to the checked-out commit                                   |
| `uncommitted`       | `--uncommitted`                 | What an unclean working tree contributes: `all`, `staged` or `none`. See [below](#uncommitted-changes) |
| `filter-file-path`  | `--filter-file-path`            | A `.sln`, `.slnx` or `.slnf` to discover projects from, instead of searching the repository           |
| `exclude-output`    | `--exclude-output`              | .NET regex. Matching projects are still evaluated and still affect their dependents, they are only kept out of the output |
| `exclude-discovery` | `--exclude-discovery`           | .NET regex. Matching projects are never loaded, so one MSBuild cannot evaluate stops failing the run  |
| `no-gitignore`      | `--no-gitignore`                | Discover projects under paths git ignores, such as build output or nested clones. Defaults to `false` |
| `output-format`     | `--format`                      | Space-separated formats: `text`, `traversal`, `json`, `slnf`. Defaults to `text traversal`             |
| `to`                | —                               | **Deprecated and ignored.** See [below](#the-to-input)                                                |
| `solution-path`     | `--filter-file-path`            | **Deprecated**, use `filter-file-path`                                                               |
| `exclude`           | `--exclude-output`              | **Deprecated**, use `exclude-output`                                                                 |

### Outputs

| Output     | Description                                                                       |
| ---------- | ----------------------------------------------------------------------------------- |
| `affected` | Contents of `affected.txt`, one project path per line. Empty when nothing changed     |

The output is read from `affected.txt`, so it is only set when the format list contains `text`. Asking for `output-format: traversal` alone leaves `affected` empty on every run, which reads exactly like "nothing was affected" — and the step conditions built on it skip everything.

When nothing is affected the tool exits `166`, which the action reports as success with an empty `affected` output. Neither output file is written in that case, which is what the `!= ''` guards on the later steps are for. Any other non-zero exit fails the step with the tool's stderr in the log.

### Uncommitted changes

dotnet-affected 7 ends every comparison at the working tree. `uncommitted` chooses what a working tree that is not clean contributes on top of the commits since `from`.

The default depends on whether there is a baseline to compare against:

- **`from` is set → `none`.** Only the commits count. Steps that run before this one — restore, code generation, version stamping — write into the checkout, and none of that should change which projects are reported.
- **`from` is not set → `all`.** `from` defaults to the checked-out commit, so ignoring the working tree too would compare that commit against itself and report nothing on every run.

Set it explicitly to override either.

### The `to` input

`--to` is deprecated in dotnet-affected 7 and accepted only when it names the commit already checked out, which makes it a no-op. Actions checks out the commit being built, so the input has nothing left to express and **the action ignores it**, warning once per run.

Remove it. If it was there to keep the working tree out of a `from`/`to` comparison, that is what `uncommitted: none` does now — and it is already the default whenever `from` is set.

## Upgrading from `@v1`

```yaml
# before
- uses: leonardochaia/dotnet-affected-action@v1
  with:
    from: ${{ steps.set_shas.outputs.base }}
    to: ${{ steps.set_shas.outputs.head }}

# after
- uses: leonardochaia/dotnet-affected-action@v7
  with:
    from: ${{ steps.set_shas.outputs.base }}
```

Then rename `solution-path` to `filter-file-path` and `exclude` to `exclude-output`. Both old names still work and warn.

`@v7` drives dotnet-affected 7, which changes what gets discovered as well as what gets compared — `.gitignore` is honoured during discovery, deleted files are attributed to their projects, and unknown `--assume-changes` values now fail. See the [v6 to v7 upgrade guide](https://github.com/leonardochaia/dotnet-affected) before rolling it out.

If you are pinned to `@v1.4` or earlier, those tags install an unpinned dotnet-affected and will pull in 7.x as soon as it is published — a v6-era action driving a v7 tool. Move to `@v7`, or hold the tool back with `toolVersion: '6.*'`, which works on every published version.
