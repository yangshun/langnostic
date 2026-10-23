# Typechecking benchmark

Measured on 2026-10-23 on an Apple M5 (10 cores, 24 GiB RAM), macOS arm64,
Node.js 24.14.0. Source revision: `c1bb578ccbbebe55ad737bc5740a701e101de1b9`
with the tsrs migration applied. No application source or tsconfig options changed.

TypeScript was subsequently upgraded to `7.1.0-beta`. These results retain the
original `7.0.2` baseline and do not compare against the upgraded compiler.

- Before: TypeScript `7.0.2` (the native Go compiler).
- After: tsrs `0.18.0-ts7.1.0-dev.20260929`, reporting TypeScript
  `7.1.0-dev.20260930.4`, upstream commit `b85298b6a81f`.

The compiler targets differ. These measurements compare the installed migration
versions; they do not establish general equivalence between the compilers.

## Compiler time and memory

Each project received two untimed warmups per compiler, then ten measured runs.
Compiler order alternated each round. Native binaries ran serially with the same
four checker threads, existing tsconfig, `--noEmit`, `--incremental false`, and
`--pretty false`. Vite+ task caching and Node/package-manager launcher overhead
are excluded. Filesystem caches were warm; they were not flushed.

Wall time includes native process startup and exit. Peak resident memory comes
from `os.wait4().ru_maxrss` for each native compiler process. Values below are
medians; memory is MiB. Extended diagnostics ran separately from timed checks.

| Project         | Files, both compilers | tsc time | tsrs time | Speedup | tsc peak RSS | tsrs peak RSS | Memory reduction |
| --------------- | --------------------: | -------: | --------: | ------: | -----------: | ------------: | ---------------: |
| langnostic      |                   878 | 161.4 ms |   45.2 ms |   3.57× |        282.6 |         102.9 |            63.6% |
| plugin-formatjs |                   372 |  50.7 ms |   25.9 ms |   1.96× |        140.5 |          64.6 |            54.0% |
| plugin-mdx      |                   756 |  63.3 ms |   32.3 ms |   1.96× |        168.0 |          75.1 |            55.3% |

The sum of project medians fell from **275.4 ms to 103.4 ms**
(**2.66× faster; 62.5% less time**). This is a sum of
separate compiler checks, not the elapsed time of a parallel workspace command.
All 60 measured invocations exited successfully with zero diagnostics.

## Full workspace command

The measured command was:

```sh
vp run --no-cache -r typecheck
```

This includes the unchanged Blume/Astro checker, a dependency build of
`langnostic`, task scheduling, and CLI launchers. After the initial before/after
batches, five additional pairs alternated compiler order. The three library
task commands were temporarily switched between their original `tsc` and
migrated `tsrs --noEmit` forms, then restored. Each run used default compiler
thread settings. Every workspace run passed.

| Compiler in library tasks |  Median |         Range |
| ------------------------- | ------: | ------------: |
| tsc                       | 7.837 s | 4.739–8.570 s |
| tsrs                      | 5.738 s | 3.961–8.847 s |

The wide, overlapping ranges do **not** establish a reliable whole-workspace
speedup. The isolated compiler results above show the typechecker improvement;
builds, docs checking, and run-to-run variation dominate this workspace command.

## Raw timing samples

Native process wall times in milliseconds:

| Run | Core tsc | Core tsrs | FormatJS tsc | FormatJS tsrs | MDX tsc | MDX tsrs |
| --- | -------: | --------: | -----------: | ------------: | ------: | -------: |
| 1   |  162.208 |    45.036 |       50.153 |        26.080 |  61.325 |   32.403 |
| 2   |  159.276 |    45.018 |       50.633 |        25.804 |  64.219 |   31.543 |
| 3   |  153.698 |    44.191 |       61.132 |        25.943 |  65.110 |   31.992 |
| 4   |  339.289 |    61.474 |       52.363 |        26.893 |  60.754 |   32.486 |
| 5   |  165.194 |    46.138 |       52.353 |        25.900 |  62.500 |   33.016 |
| 6   |  152.073 |    45.521 |       49.981 |        26.284 |  64.763 |   31.954 |
| 7   |  165.160 |    45.032 |       50.140 |        25.855 |  63.026 |   31.900 |
| 8   |  160.512 |    44.991 |       50.748 |        24.854 |  62.108 |   32.133 |
| 9   |  152.933 |    46.259 |       53.625 |        25.005 |  63.639 |   32.599 |
| 10  |  164.849 |    45.394 |       49.930 |        25.483 |  65.419 |   32.699 |

Workspace wall times in seconds:

| Pair |   tsc |  tsrs | Compiler order |
| ---- | ----: | ----: | -------------- |
| 1    | 4.739 | 4.276 | tsc → tsrs     |
| 2    | 5.266 | 3.961 | tsrs → tsc     |
| 3    | 7.837 | 8.595 | tsc → tsrs     |
| 4    | 8.499 | 8.847 | tsrs → tsc     |
| 5    | 8.570 | 5.738 | tsc → tsrs     |

## Reproduction

Build workspace declarations first with `vp run build`. For each of
`packages/langnostic`, `packages/plugin-formatjs`, and `packages/plugin-mdx`,
run the following with both compilers, two warmups and ten alternating samples:

```sh
vp exec tsc --project packages/langnostic --noEmit --incremental false --pretty false --checkers 4
vp exec tsrs --project packages/langnostic --noEmit --incremental false --pretty false --checkers 4
```

These commands include CLI launcher overhead. To reproduce the native timings,
resolve the executables once and invoke those paths directly:

```sh
vp exec node --input-type=module -e 'import tsc from "./node_modules/typescript/lib/getExePath.js"; import tsrs from "./node_modules/tsrs/lib/getExePath.js"; console.log(JSON.stringify({tsc:tsc(),tsrs:tsrs()}))'
```

Native binary SHA-256 hashes for this run:

| Compiler | SHA-256                                                            |
| -------- | ------------------------------------------------------------------ |
| tsc      | `a82f731365ad69d5c4c15f5e18fba4584bf3b7b839960172a76c3462b5114bf2` |
| tsrs     | `b3f1c65d555aa0dbd665922353c867a5332b00894f5c890cbf8044801fa13260` |

[tsrs CLI documentation](https://github.com/oxc-project/tsrs/blob/main/docs/USAGE.md)
describes compiler flags and thread settings. TypeScript remains installed for
declaration builds, Astro tooling, and published-type compatibility testing.
Vite+ retains its built-in type-aware linting and type checks.
