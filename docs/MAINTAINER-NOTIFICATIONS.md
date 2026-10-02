# Automated maintainer notifications

Oqerun Store can notify maintainers when an open-source project is discovered by the scheduled GitHub catalog sync.

## What happens

1. GitHub topic searches discover public repositories.
2. The catalog sync requires a public homepage and an SPDX license.
3. The discovered app is kept as **Community / Unverified** in `src/data/remoteCatalog.ts`.
4. A separate daily workflow checks the discovered candidates.
5. For candidates that have not already been notified, the workflow opens one issue in the original repository.
6. The issue contains a stable marker so later runs do not create duplicates.
7. At most five new maintainer issues are created per run.

The notification does not publish the project as official or verified, and it does not copy or redistribute the project's source code.

## Required secret

The Store repository's built-in `GITHUB_TOKEN` is scoped to the Store repository. It should not be used to create issues in unrelated repositories. GitHub documents that cross-repository issue creation requires a token with issue-write access to the target repository. citeturn1search0

Create a repository secret named:

`MAINTAINER_GITHUB_TOKEN`

A fine-grained personal access token should be limited to the repositories where notifications are allowed and granted **Issues: Read and write**. GitHub recommends least-privilege permissions for workflow secrets. citeturn1search2turn3search4

Without this secret, the notification workflow safely skips external issue creation. Catalog discovery continues to work.

## Workflow timing

- Community catalog sync: daily at 03:17 UTC.
- Maintainer notifications: daily at 04:17 UTC.
- Both workflows also support manual `workflow_dispatch`.

The one-hour separation gives the catalog sync time to finish before the notification pass reads `remoteCatalog.ts`.

## Manual setup

In the Store repository:

1. Open **Settings → Secrets and variables → Actions**.
2. Create a new repository secret named `MAINTAINER_GITHUB_TOKEN`.
3. Use a fine-grained GitHub token with only the required repository access and **Issues: Read and write**.
4. Run **Actions → Notify Community App Maintainers → Run workflow**.

GitHub Actions permissions should remain minimal; the notification workflow itself only requests read access to the Store repository. citeturn3search3
