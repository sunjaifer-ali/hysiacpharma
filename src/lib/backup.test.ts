import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { booksFingerprint, parseBooksBackup, wrapBackup } from "./backup.ts";
import { isDriveFolder, parseDriveFile, parseDriveFiles, parseDriveText } from "./drive-shape.ts";

const company = {
  legalName: "Hysiac Pharmaceuticals Pvt Ltd",
  gstin: "32AAECH8127L1ZH",
  nextNumber: 1,
  nextPurchaseNumber: 1,
  nextReturnNumber: 1,
  nextCreditNoteNumber: 1,
} as never;

describe("backup parse", () => {
  it("reads a wrapped Hysiac snapshot", () => {
    const books = wrapBackup({
      company,
      products: [],
      parties: [],
      invoices: [],
      purchases: [],
      purchaseOrders: [],
      quotes: [],
      creditNotes: [],
      payments: [],
    });
    const parsed = parseBooksBackup(JSON.parse(JSON.stringify(books)));
    assert.equal(parsed.company.gstin, "32AAECH8127L1ZH");
    assert.equal(parsed.invoices.length, 0);
  });

  it("still reads the older unwrapped export", () => {
    const parsed = parseBooksBackup({
      company,
      invoices: [],
    });
    assert.equal(parsed.products.length, 0);
    assert.equal(parsed.purchases.length, 0);
  });

  it("rejects junk", () => {
    assert.throws(() => parseBooksBackup({ hello: true }), /Not a Hysiac backup/);
  });

  it("fingerprints change when invoice count changes", () => {
    const a = {
      company,
      products: [],
      parties: [],
      invoices: [],
      purchases: [],
      purchaseOrders: [],
      quotes: [],
      creditNotes: [],
      payments: [],
    };
    const b = {
      ...a,
      invoices: [{ updatedAt: "1" }] as typeof a.invoices,
    };
    assert.notEqual(booksFingerprint(a), booksFingerprint(b));
  });

  it("fingerprints change when an older invoice is edited", () => {
    const base = {
      company,
      products: [],
      parties: [],
      invoices: [
        { id: "new", updatedAt: "2026-09-22T10:00:00.000Z", notes: "a" },
        { id: "old", updatedAt: "2026-04-01T10:00:00.000Z", notes: "b" },
      ],
      purchases: [],
      creditNotes: [],
    };
    const edited = {
      ...base,
      invoices: [
        base.invoices[0],
        { ...base.invoices[1], notes: "rate correction", updatedAt: "2026-09-22T12:00:00.000Z" },
      ],
    };
    assert.notEqual(booksFingerprint(base as never), booksFingerprint(edited as never));
  });

  it("fingerprints change when a product price is edited", () => {
    const a = {
      company,
      products: [{ id: "p1", name: "Ferrobest", mrp: 70 }],
      parties: [],
      invoices: [{ updatedAt: "1" }],
      purchases: [],
      creditNotes: [],
    };
    const b = {
      ...a,
      products: [{ id: "p1", name: "Ferrobest", mrp: 75 }],
    };
    assert.notEqual(booksFingerprint(a as never), booksFingerprint(b as never));
  });
});

describe("drive shape", () => {
  it("reads nested files arrays", () => {
    const files = parseDriveFiles({
      data: { files: [{ id: "1", name: "Hysiac GST Backups", mimeType: "application/vnd.google-apps.folder" }] },
    });
    assert.equal(files.length, 1);
    assert.equal(isDriveFolder(files[0]!), true);
  });

  it("reads a single file object", () => {
    const file = parseDriveFile({ file: { id: "abc", title: "hysiac-gst-latest.json" } });
    assert.equal(file?.id, "abc");
    assert.equal(file?.name, "hysiac-gst-latest.json");
  });

  it("reads text content", () => {
    assert.equal(parseDriveText({ textContent: "{\"a\":1}" }), "{\"a\":1}");
    assert.equal(parseDriveText("raw"), "raw");
  });
});
