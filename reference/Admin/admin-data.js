// Mock data for the Thyra admin dashboard. Replace with API calls in production.
window.THYRA_ADMIN = (function () {
  const clients = [
    { id: 'adefine', name: 'Adefine Jewellery', contact: 'Amara Okafor', email: 'amara@adefinejewellery.com', phone: '+234 803 412 7781', status: 'submitted', done: 9, updated: '2026-09-26', submitted: '2026-09-26' },
    { id: 'kora', name: 'Kora Skin Co.', contact: 'Kemi Adebayo', email: 'hello@koraskin.co', phone: '+234 812 550 1903', status: 'progress', done: 5, updated: '2026-09-27' },
    { id: 'ile', name: 'Ilé Home Goods', contact: 'Segun Bakare', email: 'sales@ilehome.ng', phone: '+234 809 118 2204', status: 'notstarted', done: 0, updated: '2026-09-24' },
    { id: 'tunde', name: "Tunde's Kicks", contact: 'Tunde Ajayi', email: 'tunde@tundeskicks.com', phone: '+234 802 667 0145', status: 'submitted', done: 9, updated: '2026-09-22', submitted: '2026-09-22' },
    { id: 'ofe', name: 'Ofe Kitchen Spices', contact: 'Ngozi Eze', email: 'orders@ofekitchen.ng', phone: '+234 816 903 5521', status: 'changes', done: 9, updated: '2026-09-23', submitted: '2026-09-21' },
    { id: 'lumi', name: 'Lumi Candles', contact: 'Lola Martins', email: 'lumi.candles@gmail.com', phone: '+234 705 221 8830', status: 'progress', done: 7, updated: '2026-09-20' },
    { id: 'ada', name: 'Ada & Thread', contact: 'Ada Nwosu', email: 'ada@adaandthread.com', phone: '+234 813 040 7719', status: 'submitted', done: 9, updated: '2026-09-18', submitted: '2026-09-18' },
    { id: 'bloom', name: 'Bloom Hair Studio', contact: 'Funke Ade', email: 'bookings@bloomhair.ng', phone: '', status: 'invited', done: 0, updated: '2026-09-26', invited: '2026-09-26' },
    { id: 'nkem', name: 'Nkem Leather Works', contact: 'Nkem Obi', email: 'nkem@nkemleather.com', phone: '+234 806 772 1908', status: 'submitted', done: 9, updated: '2026-09-15', submitted: '2026-09-15' },
    { id: 'zuri', name: 'Zuri Kids', contact: 'Zainab Bello', email: 'hello@zurikids.ng', phone: '', status: 'invited', done: 0, updated: '2026-09-25', invited: '2026-09-25' },
    { id: 'oak', name: 'Oakline Furniture', contact: 'Dayo Oke', email: 'info@oakline.ng', phone: '+234 803 998 1260', status: 'submitted', done: 9, updated: '2026-09-09', submitted: '2026-09-09', archived: true },
    { id: 'sade', name: 'Sade Fragrances', contact: 'Sade Coker', email: 'sade@sadefragrances.com', phone: '+234 817 445 0093', status: 'submitted', done: 9, updated: '2026-09-04', submitted: '2026-09-04' }
  ];

  const history = {
    adefine: [ { id: 'h1', date: '2026-09-20', section: 'Visual Identity', message: 'Your primary logo is low resolution. Please upload an SVG, or a PNG at least 1000px wide.', responded: true } ],
    ofe: [ { id: 'h2', date: '2026-09-23', section: 'Shop Page', message: 'Two products are missing prices and one has no photos. Please add them so we can build your shop page.', responded: false } ]
  };

  const leads = [
    { id: 'l1', name: 'Mira Bakes', contact: 'Mira Johnson', type: 'Food & drink', phone: '+234 810 441 2290', email: 'mira@mirabakes.ng', budget: '₦500k–₦1m', timeline: 'This month', call: '2026-09-30', stage: 'booked' },
    { id: 'l2', name: 'Kaftan House', contact: 'Bisi Alade', type: 'Fashion & apparel', phone: '+234 803 556 7812', email: 'bisi@kaftanhouse.com', budget: '₦1m–₦2m', timeline: 'Next 1–3 months', call: '2026-09-26', stage: 'won' },
    { id: 'l3', name: 'Glow by Tife', contact: 'Tife Ogun', type: 'Beauty & skincare', phone: '+234 902 114 3378', email: 'tife@glowbytife.com', budget: 'Under ₦500k', timeline: 'Just exploring', call: '2026-09-24', stage: 'notfit' },
    { id: 'l4', name: 'Nest & Oak', contact: 'Chinedu Ibe', type: 'Home & living', phone: '+234 815 228 9040', email: 'hello@nestandoak.ng', budget: '₦1m–₦2m', timeline: 'This month', call: '2026-10-02', stage: 'booked' },
    { id: 'l5', name: 'Little Steps', contact: 'Hauwa Musa', type: 'Kids & baby', phone: '+234 706 330 1185', email: 'hauwa@littlesteps.ng', budget: '₦500k–₦1m', timeline: 'Next 1–3 months', call: '', stage: 'new' },
    { id: 'l6', name: 'Vital Greens', contact: 'Emeka Nnaji', type: 'Health & wellness', phone: '+234 818 901 6624', email: 'emeka@vitalgreens.ng', budget: '₦2m+', timeline: 'This month', call: '', stage: 'new' },
    { id: 'l7', name: 'Eko Beads', contact: 'Ronke Ade', type: 'Jewellery & accessories', phone: '+234 809 772 4410', email: 'ronke@ekobeads.com', budget: '₦500k–₦1m', timeline: 'This month', call: '2026-09-19', stage: 'won' }
  ];


  const adefine = {
    business: {
      name: 'Adefine Jewellery',
      description: 'Handmade gold-plated and beaded jewellery for everyday wear and special occasions. Every piece is finished by hand in our Lagos studio.',
      email: 'amara@adefinejewellery.com', phone: '+234 803 412 7781',
      address: '14 Admiralty Way, Lekki Phase 1, Lagos'
    },
    shop: {
      count: '20–50',
      categories: ['Earrings', 'Necklaces', 'Bracelets', 'Rings', 'Gift sets'],
      products: [
        { name: 'Ìfẹ́ Gold Hoop Earrings', category: 'Earrings', price: '₦38,000', description: 'Lightweight 18k gold-plated hoops with a brushed finish. Hypoallergenic posts, made to be worn all day.', images: ['ife-hoops-front.jpg', 'ife-hoops-side.jpg', 'ife-hoops-model.jpg'],
          variations: [ { name: 'Size', priceVaries: true, options: [ { label: 'Small (20mm)', price: '₦38,000' }, { label: 'Medium (30mm)', price: '₦42,000' }, { label: 'Large (40mm)', price: '₦46,000' } ] },
                        { name: 'Finish', priceVaries: false, options: [ { label: 'Gold' }, { label: 'Silver' } ] } ] },
        { name: 'Oyin Pearl Necklace', category: 'Necklaces', price: '₦55,000', description: 'Freshwater pearls strung on silk with a gold-plated lobster clasp.', images: ['oyin-pearl-flat.jpg', 'oyin-pearl-model.jpg'],
          variations: [ { name: 'Length', priceVaries: true, options: [ { label: '16 inch', price: '₦55,000' }, { label: '18 inch', price: '₦58,000' } ] } ] },
        { name: 'Coral Bead Bracelet', category: 'Bracelets', price: '₦24,500', description: 'Stretch bracelet in hand-selected glass beads. One size fits most wrists.', images: ['coral-bracelet.jpg', 'coral-stack.jpg', 'coral-colours.jpg', 'coral-packaging.jpg'],
          variations: [ { name: 'Colour', priceVaries: false, options: [ { label: 'Coral' }, { label: 'Ivory' }, { label: 'Onyx' } ] } ] },
        { name: 'Ayo Signet Ring', category: 'Rings', price: '₦31,000', description: 'Chunky signet ring with a polished oval face. Engraving available.', images: ['ayo-signet.jpg', 'ayo-engraved.jpg'],
          variations: [ { name: 'Ring size', priceVaries: false, options: [ { label: '6' }, { label: '7' }, { label: '8' }, { label: '9' } ] },
                        { name: 'Engraving', priceVaries: true, options: [ { label: 'None', price: '₦31,000' }, { label: 'Initials', price: '₦35,000' } ] } ] },
        { name: 'Celebration Gift Box', category: 'Gift sets', price: '₦72,000', description: 'Hoops, bracelet and a pearl pendant in our signature cream gift box.', images: ['gift-box-open.jpg'], variations: [] }
      ]
    },
    home: {
      media: [ { name: 'hero-video.mp4', meta: 'MP4 · 18.2 MB' }, { name: 'hero-still-01.jpg', meta: 'JPG · 2.4 MB' }, { name: 'hero-still-02.jpg', meta: 'JPG · 2.1 MB' } ],
      bestSellers: ['Ìfẹ́ Gold Hoop Earrings', 'Coral Bead Bracelet', 'Oyin Pearl Necklace'],
      newIn: ['Ayo Signet Ring', 'Celebration Gift Box'],
      testimonials: ['"I wear my hoops every single day and they still look new." — Tomi A.', '"Beautiful packaging. Perfect for gifting." — Chioma O.'],
      excerpt: 'Jewellery made slowly, by hand, in Lagos — for the woman who dresses for herself first.',
      differentiators: ['Handmade in Lagos', 'Hypoallergenic finishes', 'Free gift wrapping']
    },
    about: {
      story: 'Adefine started in 2019 at my kitchen table. I was making pieces for friends\u2019 weddings, and the orders kept coming through WhatsApp. By 2022 I had a small studio and two apprentices, but every sale still depended on someone seeing my status at the right moment.\n\nI want a store that works while I\u2019m at the workbench.',
      vision: 'To be the first name Nigerian women think of for everyday fine jewellery.',
      mission: 'Make well-finished, handmade jewellery that feels personal and lasts.',
      whyDiff: 'Most jewellery at our price point is imported and mass-produced. Every Adefine piece is finished by hand, and we repair anything we sell for free in the first year.',
      values: ['Craft', 'Honesty', 'Warmth']
    },
    contact: {
      phone: '+234 803 412 7781', email: 'hello@adefinejewellery.com',
      address: '14 Admiralty Way, Lekki Phase 1, Lagos',
      formFields: ['Name (required)', 'Email (required)', 'Phone', 'Reason: Order enquiry / Custom piece / Repairs', 'Message (required)']
    },
    inspiration: {
      refs: [ { name: 'ref-mejuri-home.png', meta: 'PNG · 1.1 MB' }, { name: 'ref-product-page.png', meta: 'PNG · 860 KB' }, { name: 'ref-about-layout.png', meta: 'PNG · 740 KB' }, { name: 'ref-instagram-grid.png', meta: 'PNG · 1.3 MB' } ],
      notes: 'We like calm layouts with lots of space, big product photos and warm neutral colours. Nothing too flashy.'
    },
    identity: {
      tones: ['Warm', 'Refined'], color: '#B8894D',
      logos: [ { name: 'adefine-logo-primary.svg', meta: 'SVG · 24 KB' }, { name: 'adefine-logo-mark.png', meta: 'PNG · 180 KB' } ],
      favicon: [ { name: 'favicon.png', meta: 'PNG · 12 KB' } ],
      fonts: ''
    },
    social: { instagram: '@adefinejewellery', tiktok: '@adefine.jewels', facebook: 'facebook.com/adefinejewellery', x: '', whatsapp: '+234 803 412 7781' },
    policies: {
      privacy: '',
      privacyDraft: true,
      returns: 'We accept returns within 7 days of delivery for unworn items in their original packaging. Custom and engraved pieces cannot be returned. Refunds are processed within 5 working days once we receive the item.',
      terms: '',
      termsDraft: true,
      shipping: 'Lagos deliveries arrive in 1–2 working days. Other states arrive in 3–5 working days. Free delivery on orders over ₦100,000.'
    }
  };

  const kora = {
    business: {
      name: 'Kora Skin Co.',
      description: 'Small-batch skincare made with shea, black soap and botanical oils. Formulated for melanin-rich skin.',
      email: 'hello@koraskin.co', phone: '+234 812 550 1903', address: '3 Ogunlana Drive, Surulere, Lagos'
    },
    shop: {
      count: '10–20',
      categories: ['Cleansers', 'Oils', 'Body care'],
      products: [
        { name: 'Black Soap Gel Cleanser', category: 'Cleansers', price: '₦9,500', description: 'A gentle daily cleanser made with African black soap and aloe.', images: ['cleanser-bottle.jpg', 'cleanser-texture.jpg'],
          variations: [ { name: 'Size', priceVaries: true, options: [ { label: '150ml', price: '₦9,500' }, { label: '300ml', price: '' } ] } ] },
        { name: 'Glow Facial Oil', category: 'Oils', price: '', description: 'Lightweight blend of marula, rosehip and baobab oils.', images: ['glow-oil.jpg'], variations: [] },
        { name: 'Baobab Lip Balm', category: 'Body care', price: '', description: 'Tinted lip balm with baobab oil and shea.', images: [], variations: [] },
        { name: 'Travel Kit', category: 'Body care', price: '', description: 'Mini cleanser, oil and body butter in a pouch.', images: [], variations: [] },
        { name: 'Whipped Shea Body Butter', category: 'Body care', price: '₦11,000', description: 'Raw shea whipped with coconut oil. Unscented or lightly scented.', images: ['shea-jar.jpg', 'shea-open.jpg', 'shea-swatch.jpg'],
          variations: [ { name: 'Scent', priceVaries: false, options: [ { label: 'Unscented' }, { label: 'Vanilla' }, { label: 'Lemongrass' } ] } ] }
      ]
    },
    home: {
      media: [ { name: 'kora-hero.jpg', meta: 'JPG · 3.0 MB' } ],
      bestSellers: ['Whipped Shea Body Butter', 'Black Soap Gel Cleanser'],
      newIn: ['Glow Facial Oil'],
      testimonials: [],
      excerpt: 'Skincare that respects your skin and where it comes from.',
      differentiators: ['Made in small batches', 'Formulated for melanin-rich skin']
    },
    about: {
      story: 'I started making shea butter for my own eczema in 2021. Friends asked for jars, then friends of friends. Kora is what that became.',
      vision: 'Skincare rooted in West African ingredients, trusted everywhere.',
      mission: '',
      whyDiff: 'We make every batch ourselves and publish the full ingredient list for every product.',
      values: ['Transparency', 'Care']
    },
    contact: { phone: '+234 812 550 1903', email: 'hello@koraskin.co', address: '', formFields: ['Name (required)', 'Email (required)', 'Message (required)'] }
  };


  const STATUS = {
    invited:    { label: 'Invited',           style: { border: '1px dashed rgba(26,23,20,0.35)', background: 'transparent', color: '#4A453F' } },
    notstarted: { label: 'Not started',       style: { border: '1px solid transparent', background: '#EFEAE0', color: '#6B655C' } },
    progress:   { label: 'In progress',       style: { border: '1px solid transparent', background: '#E4DDD0', color: '#1A1714' } },
    changes:    { label: 'Changes requested', style: { border: '1px solid transparent', background: 'rgba(217,113,78,0.14)', color: '#A9492A' } },
    submitted:  { label: 'Submitted',         style: { border: '1px solid #D9714E', background: '#D9714E', color: '#FFFFFF' } }
  };
  const STAGES = {
    new:    { label: 'New',         style: { border: '1px dashed rgba(26,23,20,0.35)', background: 'transparent', color: '#4A453F' } },
    booked: { label: 'Call booked', style: { border: '1px solid transparent', background: '#E4DDD0', color: '#1A1714' } },
    won:    { label: 'Won',         style: { border: '1px solid #D9714E', background: '#D9714E', color: '#FFFFFF' } },
    notfit: { label: 'Not a fit',   style: { border: '1px solid transparent', background: '#EFEAE0', color: '#6B655C' } }
  };
  const pillBase = { display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flex: '0 0 auto', padding: '4px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600 };
  const pill = (map, k) => { const d = map[k] || map[Object.keys(map)[0]]; return { label: d.label, style: { ...pillBase, ...d.style } }; };

  // Demo persistence so actions carry across pages (own key only).
  const KEY = 'thyra_admin_demo_v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const today = () => new Date().toISOString().slice(0, 10);

  return {
    clients, submissions: { adefine, kora }, fallback: adefine, leads, STATUS, STAGES,
    statusPill: (k) => pill(STATUS, k), stagePill: (k) => pill(STAGES, k), today,
    getClients() { const o = read(); return clients.concat(o.added || []).filter(c => !(o.deleted || {})[c.id]).map(c => ({ ...c, ...((o.patch || {})[c.id] || {}) })); },
    patchClient(id, patch) { const o = read(); o.patch = o.patch || {}; o.patch[id] = { ...(o.patch[id] || {}), ...patch }; write(o); },
    addClient(c) { const o = read(); o.added = (o.added || []).concat([c]); write(o); },
    removeClient(id) { const o = read(); o.deleted = { ...(o.deleted || {}), [id]: true }; write(o); },
    getHistory(id) { const o = read(); return (history[id] || []).concat(((o.history || {})[id]) || []); },
    addHistory(id, entry) { const o = read(); o.history = o.history || {}; o.history[id] = (o.history[id] || []).concat([entry]); write(o); },
    getLeads() { const o = read(); return leads.map(l => ({ ...l, ...((o.leads || {})[l.id] || {}) })); },
    patchLead(id, patch) { const o = read(); o.leads = o.leads || {}; o.leads[id] = { ...(o.leads[id] || {}), ...patch }; write(o); }
  };
})();
