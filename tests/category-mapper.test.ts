import { describe, it, expect } from "vitest";
import { resolveCategory, resolveSubCategory } from "../lib/category-mapper";

describe("resolveCategory", () => {
  // ── Each of the 14 Treez categories should have keyword rules ──────────

  it("resolves Beverage from keyword", () => {
    const res = resolveCategory("Beverage", "", "Sparkling Seltzer");
    expect(res.category).toBe("Beverage");
  });

  it("resolves CBD from keyword", () => {
    const res = resolveCategory("CBD", "", "CBD Tincture 500mg");
    expect(res.category).toBe("CBD");
  });

  it("resolves Cartridge from keyword", () => {
    const res = resolveCategory("Vape Cartridge", "", "510 Cart");
    expect(res.category).toBe("Cartridge");
  });

  it("resolves Edible from keyword", () => {
    const res = resolveCategory("Gummy", "", "Sour Gummies 10mg");
    expect(res.category).toBe("Edible");
  });

  it("resolves Extract from keyword", () => {
    const res = resolveCategory("Concentrate", "", "Live Resin Badder");
    expect(res.category).toBe("Extract");
  });

  it("resolves Flower from keyword", () => {
    const res = resolveCategory("Flower", "", "Blue Dream");
    expect(res.category).toBe("Flower");
  });

  it("resolves Merch from keyword", () => {
    const res = resolveCategory("Accessories", "", "Glass Pipe");
    expect(res.category).toBe("Merch");
  });

  it("resolves Misc from keyword", () => {
    const res = resolveCategory("Miscellaneous", "", "Bath Bomb");
    expect(res.category).toBe("Misc");
  });

  it("resolves Non-Inv from keyword", () => {
    const res = resolveCategory("Gift Card", "", "Store Gift Card");
    expect(res.category).toBe("Non-Inv");
  });

  it("resolves Pill from keyword", () => {
    const res = resolveCategory("Capsule", "", "THC Capsules 25mg");
    expect(res.category).toBe("Pill");
  });

  it("resolves Plant from keyword", () => {
    const res = resolveCategory("Clone", "", "OG Kush Clone");
    expect(res.category).toBe("Plant");
  });

  it("resolves Preroll from keyword", () => {
    const res = resolveCategory("Pre-Roll", "", "Infused Joint 1g");
    expect(res.category).toBe("Preroll");
  });

  it("resolves Tincture from keyword", () => {
    const res = resolveCategory("Tincture", "", "Full Spectrum Dropper");
    expect(res.category).toBe("Tincture");
  });

  it("resolves Topical from keyword", () => {
    const res = resolveCategory("Topical", "", "Pain Relief Balm");
    expect(res.category).toBe("Topical");
  });

  // ── Combined field matching ────────────────────────────────────────────

  it("uses externalCategory when category is ambiguous", () => {
    const res = resolveCategory("Other", "Vape", "Pax Pod 0.5g");
    expect(res.category).toBe("Cartridge");
  });

  it("uses productName when category fields empty", () => {
    const res = resolveCategory("", "", "Blue Dream Pre-Roll 1g");
    expect(res.category).toBe("Preroll");
  });

  // ── Fallback to Misc ──────────────────────────────────────────────────

  it("falls back to Misc when nothing matches", () => {
    const res = resolveCategory("", "", "Unknown Product");
    expect(res.category).toBe("Misc");
  });

  // ── Returns proper CategoryResolution shape ───────────────────────────

  it("returns uom and merchSize alongside category/subCategory", () => {
    const res = resolveCategory("Flower", "", "Blue Dream 3.5g");
    expect(res).toHaveProperty("uom");
    expect(res).toHaveProperty("merchSize");
    expect(res.uom).toBe("grams");
    expect(res.merchSize).toBe("");
  });

  it("returns each uom and merchSize for Merch category", () => {
    const res = resolveCategory("Merch", "", "Battery");
    expect(res.uom).toBe("each");
    expect(res.merchSize).not.toBe("");
  });
});

describe("resolveSubCategory", () => {
  it("resolves Flower subcategory from product name", () => {
    const sub = resolveSubCategory("Flower", "Blue Dream Pre-Pack 3.5g");
    expect(sub).toBeTruthy();
    expect(typeof sub).toBe("string");
  });

  it('resolves Edible subcategory "Gummy" from product name', () => {
    const sub = resolveSubCategory("Edible", "Sour Gummy Bears 10mg");
    expect(sub).toBe("Gummy");
  });

  it("resolves Cartridge default subcategory", () => {
    const sub = resolveSubCategory("Cartridge", "Some Generic Cart");
    expect(sub).toBeTruthy();
  });

  it("resolves Extract subcategory from name keywords", () => {
    const sub = resolveSubCategory("Extract", "Live Rosin 1g");
    expect(sub).toBe("Live Rosin");
  });

  it("returns default subcategory when no name rules match", () => {
    const sub = resolveSubCategory("Flower", "Generic Product");
    expect(sub).toBeTruthy(); // Should return default like "Pre-Pack" or "Flower - General"
  });

  it('resolves Preroll subcategory "Infused" from name', () => {
    const sub = resolveSubCategory("Preroll", "Jeeter Infused Pre-Roll 1g");
    expect(sub).toBe("Infused");
  });

  it("resolves Topical subcategory from name", () => {
    const sub = resolveSubCategory("Topical", "CBD Pain Relief Balm");
    expect(sub).toBe("Balm");
  });

  it("resolves Tincture default subcategory", () => {
    const sub = resolveSubCategory("Tincture", "Full Spectrum Oil");
    expect(sub).toBeTruthy();
  });
});
