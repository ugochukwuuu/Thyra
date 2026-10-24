// Turns a stored submission into the files the admin downloads: the WooCommerce product CSV
// and the list of uploaded files for the asset zip.

/** Section names by wizard step, as clients and staff see them. */
export const SECTION_NAMES = [
  'Business info',
  'Shop page',
  'Home page',
  'About the brand',
  'Contact us page',
  'Design inspiration',
  'Visual identity',
  'Social media',
  'Policy pages',
];

const LOGO_LABELS = { primary: 'primary', mark: 'mark', light: 'light-background', dark: 'dark-background', favicon: 'favicon' };

const slug = (s, fallback = 'item') =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback;

const blank = (s) => !String(s ?? '').trim();

/** Every uploaded file in a submission, with the folder it belongs in inside the zip. */
export function collectFiles(row) {
  const out = [];
  const add = (folder, file, prefix = '') => file?.url && out.push({ folder, file, prefix });

  (row.products?.items ?? []).forEach((p, i) => {
    const folder = `shop/${String(i + 1).padStart(2, '0')}-${slug(p.name, 'product')}`;
    add(folder, p.mainImage, 'main-');
    (p.images ?? []).forEach((f) => add(folder, f));
  });
  (row.home_page?.media ?? []).forEach((f) => add('home-page/media', f));
  (row.home_page?.testimonials ?? []).forEach((t) => add('home-page/testimonials', t.photo, `${slug(t.name, 'customer')}-`));
  (row.inspiration?.items ?? []).forEach((it) => add('design-inspiration', it.screenshot));
  for (const [slot, label] of Object.entries(LOGO_LABELS)) add('visual-identity/logos', row.visual_identity?.logos?.[slot], `${label}-`);
  add('visual-identity', row.visual_identity?.brandGuide, 'brand-guide-');

  // Give every entry a unique, readable path.
  const used = new Set();
  return out.map(({ folder, file, prefix }) => {
    const base = (prefix + (file.name || file.publicId.split('/').pop())).replace(/[\\/:*?"<>|]+/g, '-');
    let path = `${folder}/${base}`;
    for (let n = 2; used.has(path.toLowerCase()); n++) {
      path = `${folder}/${base.replace(/(\.[^.]*)?$/, `-${n}$1`)}`;
    }
    used.add(path.toLowerCase());
    return { path, file };
  });
}

/** Products that would import into WooCommerce incomplete, grouped the way the export warning shows them. */
export function productIssues(row) {
  const items = row.products?.items ?? [];
  const noPrice = [];
  const noImages = [];
  const variationNoPrice = [];
  items.forEach((p) => {
    const hasVaryingPrice = (p.variations ?? []).some((v) => v.priceVaries);
    if (p.price == null && !hasVaryingPrice) noPrice.push(p.name || 'Untitled product');
    if (!p.mainImage && !(p.images ?? []).length) noImages.push(p.name || 'Untitled product');
    (p.variations ?? []).forEach((v) => {
      if (!v.priceVaries) return;
      (v.options ?? []).forEach((o) => o.price == null && variationNoPrice.push(`${p.name} — ${o.label}`));
    });
  });
  return { noPrice, noImages, variationNoPrice };
}

// ---- WooCommerce CSV ----

/** Spreadsheet apps run cells starting with these as formulas; client text must never do that. */
function cell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+@\t\r]/.test(s) || /^-[^\s\d]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const STOCK = { instock: 1, outofstock: 0, onbackorder: 'backorder' };

/** Every combination of one option from each variation, e.g. Size × Colour. */
function combinations(variations) {
  return variations.reduce(
    (acc, v) => acc.flatMap((combo) => v.options.map((o) => [...combo, { variation: v, option: o }])),
    [[]],
  );
}

/**
 * Builds a CSV in WooCommerce's product importer format. Products with variations become a
 * "variable" product plus one "variation" row per combination of options.
 */
export function productsCsv(row, settings, businessName) {
  const items = row.products?.items ?? [];
  const categories = row.products?.categories ?? [];
  const catName = (id) => categories.find((c) => c.id === id)?.name?.trim() ?? '';
  const subName = (id) => {
    for (const c of categories) {
      const s = (c.subcategories ?? []).find((x) => x.id === id);
      if (s) return { parent: c.name?.trim() ?? '', name: s.name?.trim() ?? '' };
    }
    return null;
  };

  const usable = items
    .map((p) => ({ ...p, variations: (p.variations ?? []).filter((v) => !blank(v.name) && (v.options ?? []).length) }))
    .filter((p) => settings.includeNoImages || p.mainImage || (p.images ?? []).length);

  const attrCount = Math.max(1, ...usable.map((p) => p.variations.length));
  const header = [
    'Type', 'SKU', 'Name', 'Published', 'Short description', 'Description', 'In stock?', 'Regular price', 'Categories', 'Images', 'Parent',
  ];
  for (let i = 1; i <= attrCount; i++) {
    header.push(`Attribute ${i} name`, `Attribute ${i} value(s)`, `Attribute ${i} visible`, `Attribute ${i} global`);
  }

  const published = settings.importAs === 'published' ? 1 : -1;
  const stock = STOCK[settings.stockStatus] ?? 1;
  const skuBase = `${settings.skuPrefix ?? ''}${slug(businessName, 'store').toUpperCase().slice(0, 20)}`;
  const lines = [header];

  usable.forEach((p, i) => {
    const sku = `${skuBase}-${String(i + 1).padStart(3, '0')}`;
    const cats = [
      ...(p.categoryIds ?? []).map(catName),
      ...(p.subcategoryIds ?? []).map(subName).filter(Boolean).map((s) => `${s.parent} > ${s.name}`),
    ].filter(Boolean);
    // A subcategory already names its parent ("Tops > Blouses"), so don't list the parent on its own too.
    const categoryCell = cats.filter((c, _, all) => !all.some((o) => o.startsWith(`${c} > `))).join(', ');
    const images = [p.mainImage, ...(p.images ?? [])].filter(Boolean).map((f) => f.url).join(', ');
    const attrs = (pairs) => {
      const out = [];
      for (let k = 0; k < attrCount; k++) {
        const pair = pairs[k];
        out.push(pair ? pair[0] : '', pair ? pair[1] : '', pair ? pair[2] : '', pair ? 0 : '');
      }
      return out;
    };

    if (!p.variations.length) {
      lines.push(['simple', sku, p.name, published, p.shortDescription, p.longDescription, stock, p.price ?? '', categoryCell, images, '', ...attrs([])]);
      return;
    }

    lines.push([
      'variable', sku, p.name, published, p.shortDescription, p.longDescription, stock, '', categoryCell, images, '',
      ...attrs(p.variations.map((v) => [v.name, v.options.map((o) => o.label).join(', '), 1])),
    ]);
    combinations(p.variations).forEach((combo, k) => {
      // Option prices are full prices, so the first variation that sets a price decides it.
      const priced = combo.find((c) => c.variation.priceVaries && c.option.price != null);
      lines.push([
        'variation', `${sku}-${k + 1}`, `${p.name} - ${combo.map((c) => c.option.label).join(', ')}`, published, '', '', stock,
        priced ? priced.option.price : p.price ?? '', '', '', sku,
        ...attrs(combo.map((c) => [c.variation.name, c.option.label, ''])),
      ]);
    });
  });

  return `﻿${lines.map((l) => l.map(cell).join(',')).join('\r\n')}\r\n`;
}
