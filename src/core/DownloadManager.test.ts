import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadManager } from "./DownloadManager";
import type { Application } from "../models/App";

function appWithDigest(sha256: string): Application {
  return {
    id: "test-integrity-app",
    name: "Integrity test",
    version: "1.0.0",
    description: "Test fixture",
    category: "Development",
    icon: "T",
    publisher: { name: "Test publisher", verified: false },
    listing: "community",
    source: { type: "url", url: "https://example.com" },
    license: "MIT",
    type: "oqpkg",
    compatibility: { minimumOqerunVersion: "0.1.0" },
    installation: {
      method: "oqpkg",
      downloadUrl: "https://downloads.example.com/test.oqpkg",
      downloadFileName: "test.oqpkg",
      sha256,
    },
    permissions: [],
  };
}

function fakeResponse(bytes: number[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  return {
    ok: true,
    body,
    headers: {
      get(name: string) {
        if (name.toLowerCase() === "content-length") return String(bytes.length);
        if (name.toLowerCase() === "content-type") return "application/octet-stream";
        return null;
      },
    },
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DownloadManager package integrity checks", () => {
  it("rejects malformed SHA-256 metadata before making a network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(new DownloadManager().download(appWithDigest("not-a-digest")))
      .rejects.toThrow(/SHA-256 digest is invalid/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a package when the fetched bytes do not match the published digest", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse([1, 2, 3])));
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
      },
    });

    await expect(new DownloadManager().download(appWithDigest("f".repeat(64))))
      .rejects.toThrow(/SHA-256 verification failed/i);
  });

  it("rejects a download that exceeds the browser verification limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(100 * 1024 * 1024 + 1));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body,
      headers: { get: (name: string) => name.toLowerCase() === "content-length" ? "0" : null },
    } as unknown as Response));
    vi.stubGlobal("crypto", { subtle: { digest: vi.fn() } });

    await expect(new DownloadManager().download(appWithDigest("a".repeat(64))))
      .rejects.toThrow(/limited to 100 MB/i);
  });
});
