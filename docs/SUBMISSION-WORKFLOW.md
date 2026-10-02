# Oqerun Store Submission Workflow

The publish form is connected to the Store review pipeline.

## Flow

1. A developer submits the **Oqerun Store — Publish Your App** Google Form.
2. The connected intake automation checks for new responses.
3. Each new response becomes a GitHub issue in this repository with the marker `oqerun-store-submission`.
4. GitHub Actions automatically runs `scripts/scan-submission.mjs`.
5. The scanner checks the public repository for:
   - `.oqpkg`
   - Web/PWA entrypoints and manifests
   - WebAssembly
   - build metadata
   - native-only artifacts
   - optional live HTTPS URL reachability
6. The scan result is posted back to the GitHub issue.
7. The automated result is a review aid, not automatic Store approval.

The scanner never executes submitted repository code.
