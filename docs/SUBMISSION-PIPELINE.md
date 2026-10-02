# Oqerun Store submission pipeline

The Store submission flow is intentionally split into **submission**, **automated validation**, **maintainer review**, and **publication**.

## Flow

1. A submitter provides the repository, live URL, app metadata, license, type, and authorization.
2. The submission is represented as an issue containing the `<!-- oqerun-store-submission -->` marker.
3. An authorized Store maintainer comments exactly `/approve` (or `/approve <note>`).
4. GitHub Actions changes the issue to `store:reviewing`.
5. The publisher script validates:
   - public, non-archived GitHub repository;
   - detectable repository license;
   - declared license matches repository metadata;
   - valid HTTPS live URL where required;
   - requested PWA/WebAssembly/.oqpkg type is actually detectable;
   - duplicate catalog ID/repository prevention.
6. The script generates the catalog entry.
7. Community entries are recorded in `THIRD-PARTY-NOTICES.md` as community/unverified listings.
8. The Store is built with `npm ci && npm run build`.
9. Only after a successful build are the generated catalog and notices committed.
10. The issue is marked `store:published`.

## Important cross-repository limitation

GitHub's built-in `GITHUB_TOKEN` is scoped to the repository running the workflow. It cannot create a maintainer issue in an external project repository. citeturn1search0turn1search4

For community submissions, the Store therefore records that a maintainer notification is required. A future GitHub App with access to both repositories can automate that final cross-repository notification without giving the workflow a broad personal token.

## Google Form

The public Store UI embeds the Google Form used to collect submissions. The repository-side issue pipeline is the publication gate.

The external Google Form cannot be safely treated as an approval mechanism: a response must enter the repository review pipeline before it can publish a catalog entry.

## Labels

- `store:submitted` — received and awaiting review
- `store:reviewing` — automated validation/publication is running
- `store:published` — catalog and build completed
- `store:rejected` — reserved for manual review outcomes

Community apps should remain `listing: community` and `reviewStatus: unverified` until separately reviewed.
