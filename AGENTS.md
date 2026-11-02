# Oqerun Store — Project Instructions

These instructions apply to every future change in this repository.

## Project identity and architecture
- Product: Oqerun Store, the application catalogue and installation/launch surface for Oqerun OS.
- Repository: https://github.com/vruntime-labs/oqerun-store
- Deployment: GitHub Pages at https://vruntime-labs.github.io/oqerun-store/
- Keep GitHub Pages as the current host. A custom domain is not a launch prerequisite.
- Preserve the existing TypeScript/Vite architecture, catalog format, application metadata, installation bridge, and compatibility with Oqerun OS.
- Oqerun Store supports community applications and multiple app types. Do not silently narrow the catalog or break existing provider behavior.
- Native .oqpkg registration is not equivalent to a complete package download, signature verification, extraction, sandbox, or runtime permission enforcement. Describe the implemented behavior accurately.

## Mandatory working method
1. Inspect the repository tree, relevant files, workflows, and existing behavior before editing.
2. Identify the three highest-impact issues for the requested task before redesigning or refactoring.
3. Preserve completed work and existing components. Make the smallest complete change that solves the task.
4. Prefer complete, coherent file changes over disconnected snippets.
5. Keep unrelated changes out of the same pull request.
6. Do not invent APIs, catalog entries, package metadata, tests, metrics, or security guarantees.
7. Add or update regression tests for meaningful fixes.
8. Run the actual available checks. Report exact commands and outcomes; mark anything not run as unverified.
9. Use a branch and pull request for review. Do not merge or deploy without the user's explicit instruction.
10. End substantial work with changed files, commit/PR links, verification, remaining risks, and the next step.

## ChatGPT Taste Skill — design direction
For UI work, classify the task as a public-facing page, an application screen, or a redesign of an existing interface. Inspect the actual implementation and available assets. Establish the audience, user task, information hierarchy, and product-specific visual direction before coding. For existing UI, retain what works and prioritize the three most consequential problems. Design around real catalog content, clear app details, publisher/source/license/permission information, and understandable install states. Do not create a generic template that could belong to any app store.

## ChatGPT Impeccable — interface quality
Treat visual and interaction quality as a product requirement, not decoration. Use a consistent spacing, typography, color, border, radius, and elevation system. Prefer readable hierarchy, strong alignment, deliberate whitespace, restrained motion, useful empty/loading/error states, responsive behavior, keyboard access, and clear focus states. Use semantic HTML and accessible names. Avoid unnecessary gradients, decorative effects, oversized rounded controls, visual clutter, fake content, placeholder metrics, and animation that delays or distracts from tasks.

## ChatGPT VibeSec — security-first engineering
- Treat catalog data, package files, external URLs, iframe messages, and publisher claims as untrusted.
- Enforce validation at trust boundaries; browser checks alone are not authorization.
- Verify downloaded bytes against a trusted digest when possible. A digest supplied by the same untrusted publisher is integrity metadata, not proof of publisher identity.
- Validate iframe origin AND source window. Validate message schema, identifiers, URL schemes, fields, and allowed permissions.
- Do not claim runtime permission enforcement or sandboxing until it exists and is tested.
- Apply least privilege, safe URL handling, output encoding, bounded downloads, safe error handling, and regression tests.
- Never expose secrets in client bundles or repository files.
- For each finding, record severity, confidence, location, evidence, impact, conditions, remediation, and verification.
- Only assess systems the project owner is authorized to test.

## ChatGPT Memory Kit — project continuity
Maintain concise, factual project notes. Record durable decisions, changes, discoveries, tests, and blockers with dates, affected files, evidence, and verification status. Separate requested work from implemented work. Do not invent test results or retain secrets. Update the project memory when the user asks to wrap up or save the session.

## Brand and content constraints
- No purple gradients.
- No pill-shaped buttons.
- No fake reviews, customer quotes, download counts, ratings, or metrics.
- No vague hero copy, emoji icons, em dashes, AI-generated filler copy, or over-the-top scroll animations.
- No cursor animations.
- Do not add a “Made with AI” badge/tag.
- Do not use AI-slop imagery or fabricated trust signals.
- Prefer real app icons, verified screenshots, accurate descriptions, and source-backed information.
- Keep language direct, specific, and honest.
- Do not introduce a custom-domain requirement.

## Store-specific trust requirements
Every community listing should clearly distinguish verified facts from publisher-provided claims. Where available, expose publisher, source repository, license, version, download/source URL, digest status, permissions, and install/launch behavior. Warn when information is missing. Do not imply that a listing has been security-audited merely because it appears in the Store.

## Pull request and release quality
- Keep PRs focused and explain why each change is needed.
- CI must validate TypeScript/Vite builds and relevant tests.
- Check GitHub Pages base paths and public asset paths before merging.
- Verify keyboard and mobile behavior for UI changes.
- Verify real download bytes and message flows for installation/security changes.
- Document limitations and migration/configuration requirements.
