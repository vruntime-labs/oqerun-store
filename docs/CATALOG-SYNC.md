# Oqerun Store catalog synchronization

Oqerun Store has two catalog layers:

- `src/data/catalog.ts` — reviewed/maintained Store catalog.
- `src/data/remoteCatalog.ts` — generated community discovery candidates.

The scheduled workflow searches GitHub by application topics, requires an open-source SPDX license and a public homepage, and marks discovered entries as **Community / Unverified**. It does not automatically mark unknown projects as official or verified.

Discovered entries use `0.0.0` with `versionStrategy: rolling` when the repository does not expose a trustworthy release version. This prevents the Store from inventing semantic versions.

The workflow runs daily and can also be started manually from GitHub Actions.

## Review flow

1. A candidate is discovered.
2. The Store displays its source, license and unverified state.
3. A maintainer can review the project and promote it into the reviewed catalog.
4. Verified entries can receive explicit metadata and a real version strategy.

The sync workflow uses the GitHub Actions `GITHUB_TOKEN`; no user token is stored in the repository.
