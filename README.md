<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# Run dotnet-affected inside GitHub actions

dotnet-affected is a .NET tool for determining which projects are affected by a set of changes. Useful for large projects or monorepos.

Read more at <https://github.com/leonardochaia/dotnet-affected>

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
    strategy:
      matrix:
        dotnet-version: ['3.1.x', '5.0', '6.0']
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - name: Setup .NET Core SDK ${{ matrix.dotnet-version }}
        uses: actions/setup-dotnet@v1.7.2
        with:
          dotnet-version: ${{ matrix.dotnet-version }}

      - uses: nrwl/nx-set-shas@v4
        id: set_shas

      - uses: ./
        id: dotnet_affected
        with:
          from: ${{ steps.set_shas.outputs.base }}
          to: ${{ steps.set_shas.outputs.head }}

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
    strategy:
      matrix:
        dotnet-version: ['3.1.x', '5.0', '6.0']
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 0
      - name: Setup .NET Core SDK ${{ matrix.dotnet-version }}
        uses: actions/setup-dotnet@v1.7.2
        with:
          dotnet-version: ${{ matrix.dotnet-version }}

      - uses: leonardochaia/dotnet-affected-action@v1
        id: dotnet_affected
        with:
          from: ${{ github.head_ref }}
          to: ${{ github.base_ref }}

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
