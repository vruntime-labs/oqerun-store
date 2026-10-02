const PUBLISH_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdq_tUEgcY9Dfyhtxiz2fa21n9L7unC5vgAj_Tr4GXNEweUew/viewform";

export class PublishApp {
  private dialog?: HTMLDivElement;

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

    dialog.innerHTML =
      '<div class="modal-backdrop"><section class="modal publish-modal">' +
      '<button class="modal-close publish-close" data-publish-close aria-label="Close publish dialog">×</button>' +
      '<div class="publish-header"><div class="publish-heading"><p class="eyebrow">PUBLISH YOUR APP</p><h2>Submit an application to Oqerun Store</h2><p>Complete the official submission form directly inside Oqerun Store. After you submit, our automated workflow checks the repository and prepares it for maintainer review.</p></div><div class="publish-icon" aria-hidden="true">▣</div></div>' +
      '<div class="publish-form-intro"><span class="publish-form-badge">OFFICIAL OQERUN STORE FORM</span><h3>Application submission</h3><p>Provide your app details, public GitHub repository, license and application type. The Store will automatically scan the submitted repository after the form is received.</p></div>' +
      '<div class="publish-iframe-wrap"><iframe id="publish-form-frame" title="Oqerun Store official application submission form" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>' +
      '<div class="publish-after-submit"><div><strong>What happens after submission?</strong><span>Your response is recorded, the repository is scanned automatically for .oqpkg, PWA, Web, and WebAssembly compatibility, and the submission enters the Oqerun Store review workflow.</span></div></div>' +
      '</section></div>';

    dialog.querySelectorAll("[data-publish-close]").forEach(element =>
      element.addEventListener("click", () => {
        dialog.innerHTML = "";
      })
    );

    const frame = dialog.querySelector<HTMLIFrameElement>("#publish-form-frame");
    if (frame) {
      const url = new URL(PUBLISH_FORM_URL);
      url.searchParams.set("embedded", "true");
      frame.src = url.toString();
    }
  }
}
