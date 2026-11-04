# ADR 0010: TDD and one branch per change

## Status

Accepted (reconstructed from `CLAUDE.md`, October 2026).

## Context

The project is maintained by one person with the help of coding agents. Every change needs to be verifiable, and `main` must always be deployable.

## Decision

- **TDD**: before touching product code, the failing test is written first. Unit tests go in `tests/unit`; screen behaviour gets an end-to-end test in `tests/e2e`. Then the code is written until the test passes.
- Unit and end-to-end tests are both run before delivering.
- **One branch per piece of work**, created from `main`. Work is never done on the current branch.
- Each piece of work ends with a commit, push, pull request, merge into `main`, and deletion of the branch (remote and local).

## Consequences

- Every change has a test; regressions are caught before deployment.
- The flow is longer for small changes, but it leaves a clear history of pull requests.
- The CI workflow (`.github/workflows/deploy.yml`) runs the tests again on every pull request.
