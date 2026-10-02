import { SubmissionScanner, type SubmissionReport, type ScanCheck } from "../core/SubmissionScanner";

const STORE_REPOSITORY = "vruntime-labs/oqerun-store";
const ISSUE_TEMPLATE = "app-submission.yml";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class PublishApp {
  private readonly scanner = new SubmissionScanner();
  private dialog?: HTMLDivElement;
  private report?: SubmissionReport;

  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    const trigger = this.root.querySelector<HTMLElement>(".rail-publish [data-feedback]");
    if (!trigger) return;
    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.open();
    });
  }

  private open(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    this.dialog = dialog;
    this.report = undefined;

    dialog.innerHTML =
      '<div class="modal-backdrop"><section class="modal publish-modal">' +
      '<button class="modal-close" data-publish-close>×</button>' +
      '<div class="publish-header"><div><p class="eyebrow">PUBLISH YOUR APP</p><h2>Submit an application to Oqerun Store</h2><p>Give us a public GitHub repository. The Store will inspect it and determine whether it is an Oqerun package, a web/PWA app, a WebAssembly app, or something that needs review.</p></div><div class="publish-icon">↥</div></div>' +
      '<form id="publish-form" class="publish-form">' +
      '<label>GitHub repository <input name="repository" required type="url" placeholder="https://github.com/owner/repository" autocomplete="url"></label>' +
      '<label>Live app URL <span class="publish-help">Optional. If you have a deployed HTTPS app, provide it so the Store can try a browser compatibility check.</span><input name="liveUrl" type="url" placeholder="https://example.github.io/my-app/" autocomplete="url"></label>' +
      '<p class="publish-help">We inspect public repository metadata, the Git tree, release assets and common web entry points. No repository code is executed by this scanner.</p>' +
      '<div class="publish-actions"><button type="button" class="install-button secondary" data-publish-close>Cancel</button><button type="submit" class="install-button large">Scan repository</button></div>' +
      '<p id="publish-status" class="publish-status" aria-live="polite"></p>' +
      '</form><div id="publish-result"></div></section></div>';

    dialog.querySelectorAll("[data-publish-close]").forEach(element => element.addEventListener("click", () => {
      dialog.innerHTML = "";
    }));

    const form = dialog.querySelector<HTMLFormElement>("#publish-form");
    form?.addEventListener("submit", event => {
      event.preventDefault();
      void this.scan(form);
    });
  }

  private async scan(form: HTMLFormElement): Promise<void> {
    const status = this.dialog?.querySelector<HTMLParagraphElement>("#publish-status");
    const result = this.dialog?.querySelector<HTMLDivElement>("#publish-result");
    if (!status || !result) return;

    const data = new FormData(form);
    const repository = String(data.get("repository") ?? "").trim();
    const liveUrl = String(data.get("liveUrl") ?? "").trim() || undefined;

    status.textContent = "";
    result.innerHTML = '<div class="publish-working"><span class="publish-spinner"></span><span>Scanning GitHub repository and checking web compatibility…</span></div>';

    try {
      this.report = await this.scanner.scan(repository, liveUrl);
      result.innerHTML = this.renderReport(this.report);
      this.bindReport();
      status.textContent = "Scan complete.";
    } catch (error) {
      result.innerHTML = '<div class="publish-empty">' + esc(error instanceof Error ? error.message : "The repository could not be scanned.") + '</div>';
      status.textContent = "Scan failed.";
    }
  }

  private renderReport(report: SubmissionReport): string {
    const label = report.recommendation === "native"
      ? "Oqerun package detected"
      : report.recommendation === "web"
        ? "Web-compatible"
        : report.recommendation === "wasm"
          ? "WebAssembly-compatible"
          : report.recommendation === "not-compatible"
            ? "Not browser compatible"
            : "Needs maintainer review";

    const checks = report.checks.map((check: ScanCheck) =>
      '<article class="scan-check ' + check.status + '">' +
      '<span class="scan-check-icon">' + (check.status === "pass" ? "✓" : check.status === "fail" ? "×" : check.status === "warn" ? "!" : "i") + '</span>' +
      '<div><strong>' + esc(check.label) + '</strong><span>' + esc(check.detail) + '</span></div></article>'
    ).join("");

    const notes = report.notes.length
      ? '<ul class="scan-notes">' + report.notes.map(note => '<li>' + esc(note) + '</li>').join("") + '</ul>'
      : "";

    const issueUrl = this.issueUrl(report);

    return '<section class="publish-report">' +
      '<div class="publish-summary"><div><p class="eyebrow">SCAN RESULT</p><h3>' + esc(report.name) + '</h3></div><span class="scan-badge ' + report.recommendation + '">' + label + '</span></div>' +
      '<div class="scan-meta">' +
      '<div><span>Repository</span><strong><a href="' + esc(report.repositoryUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(report.repository) + '</a></strong></div>' +
      '<div><span>Detected type</span><strong>' + esc(report.detectedType) + '</strong></div>' +
      '<div><span>License</span><strong>' + esc(report.license) + '</strong></div>' +
      '<div><span>Files scanned</span><strong>' + report.filesScanned + '</strong></div>' +
      '</div>' +
      '<div class="scan-grid">' + checks + '</div>' +
      (report.notes.length ? '<div><p class="eyebrow">REVIEW NOTES</p>' + notes + '</div>' : "") +
      '<div class="publish-report-actions">' +
      '<a class="install-button large" href="' + esc(issueUrl) + '" target="_blank" rel="noopener noreferrer">Submit scan for review ↗</a>' +
      '<button type="button" class="install-button secondary" data-copy-report>Copy scan report</button>' +
      (report.liveUrl ? '<a class="install-button secondary" href="' + esc(report.liveUrl) + '" target="_blank" rel="noopener noreferrer">Open live app ↗</a>' : "") +
      '</div>' +
      '<p class="publish-disclaimer">The scan is an automated compatibility check, not an approval. A maintainer should review the source, license, permissions, branding, security and actual runtime before listing an application.</p>' +
      '</section>';
  }

  private bindReport(): void {
    this.dialog?.querySelector("[data-copy-report]")?.addEventListener("click", async () => {
      if (!this.report) return;
      const text = this.reportText(this.report);
      try {
        await navigator.clipboard.writeText(text);
        this.dialog?.querySelector<HTMLButtonElement>("[data-copy-report]")?.replaceChildren(document.createTextNode("Copied ✓"));
      } catch {
        window.prompt("Copy this scan report:", text);
      }
    });
  }

  private reportText(report: SubmissionReport): string {
    return [
      "Oqerun Store App Submission Scan",
      "Repository: " + report.repositoryUrl,
      "Detected type: " + report.detectedType,
      "Recommendation: " + report.recommendation,
      "License: " + report.license,
      "Live URL: " + (report.liveUrl || "Not provided"),
      "Live status: " + report.liveStatus,
      "Files scanned: " + report.filesScanned,
      "",
      ...report.checks.map(check => "[" + check.status.toUpperCase() + "] " + check.label + ": " + check.detail),
      "",
      ...report.notes.map(note => "NOTE: " + note),
      "",
      "Scanned at: " + report.scannedAt
    ].join("\n");
  }

  private issueUrl(report: SubmissionReport): string {
    const params = new URLSearchParams({
      title: "Store App Submission: " + report.name,
      body: [
        "## Oqerun Store app submission",
        "",
        "Repository: " + report.repositoryUrl,
        "Live app: " + (report.liveUrl || "Not provided"),
        "Detected type: " + report.detectedType,
        "Automated recommendation: " + report.recommendation,
        "License: " + report.license,
        "",
        "### Automated scan",
        "",
        ...report.checks.map(check => "- **" + check.status.toUpperCase() + "** " + check.label + ": " + check.detail),
        "",
        "### Maintainer review",
        "",
        "- [ ] Source and license reviewed",
        "- [ ] Web/runtime compatibility reviewed",
        "- [ ] Permissions and external services reviewed",
        "- [ ] Branding and attribution reviewed",
        "- [ ] Listing metadata completed",
        "",
        "Automated scan time: " + report.scannedAt
      ].join("\n"),
      labels: "store-submission"
    });

    return "https://github.com/" + STORE_REPOSITORY + "/issues/new?template=" + encodeURIComponent(ISSUE_TEMPLATE) + "&" + params.toString();
  }
}
