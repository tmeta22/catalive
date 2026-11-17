# Atelier Solis

Made-to-measure Khmer furniture with a live 3D configurator. Mobile-first, bilingual (ខ្មែរ / English), light mode.

Pick a piece, choose a standard size or type exact dimensions, choose timber and fabric, set the details, and watch the model rebuild in 3D as you go. Price, lead time, seat counts and mattress sizes update with every change.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # data, pricing, and 3D geometry tests
npm run build      # type-checks, then builds to dist/
```

Optional environment variables (copy `.env.example` to `.env`):

| Variable | Effect |
| --- | --- |
| `VITE_TELEGRAM_USERNAME` | Orders open a chat with this account. Without it, Telegram's share sheet opens. |
| `VITE_ORDER_ENDPOINT` | Confirmed orders are POSTed here as JSON (`{ order, message, totalUsd }`). Without it, orders stay on the customer's device and are shared by Telegram, copy or print. |

No payment is taken in the app. The checkout says so, and asks the customer to wait for your confirmation.

## What's in it

- **19 pieces** in four categories (seating, tables, storage, bedroom), every one fully parametric.
- **Full custom specs**: per-product width, depth and height ranges with sliders and number fields (cm / mm / in), standard-size shortcuts, up to three material slots, and 2 to 4 detail options per piece. Round tops tie depth to width ("Diameter"), and incompatible combinations repair themselves.
- **Live 3D** (three.js): orbit and pinch, front / side / top views, measurement labels, soft shadows. Light timbers, leather, bouclé, silk, cane, stone and lacquer.
- **Try the pieces**: tap a cabinet door to swing it open, pull out a drawer, lift a pillow or a sofa cushion, or roll a bolster. Movable parts are tagged while the model is built; a reset button puts everything back. Works in the product viewer and in the catalogue book.
- **AR in your room** (WebXR): place the piece on the real floor, walk around it, change the size or the finish while it stands there. Needs an Android device with Chrome; other devices get a clear explanation and a link to open on a phone.
- **Catalogue book** (`#/book`): the whole collection as a book. A live 3D model on the right-hand page, the drawing sheet in 2D mode, a control bar with views, zoom, CAD export, save and bag, and tabs for materials, options, stock and orders.
- **Honest pricing**: the default build always costs the base price; every change shows what it adds or saves, with an itemised breakdown. Custom sizes add a week to the lead time, and only standard builds ship from stock.
- **Technical drawing**: front, side and plan elevations with dimension lines, title block and drawing number. Download as SVG or print on A3.
- **Spec sheet** (printable), **share link** (the whole configuration is in the URL), **bag** with delivery zones and the `SOLIS10` code, and an order summary ready for Telegram.
- Works offline-friendly: fonts are self-hosted, bag and preferences persist locally.

## How it's built

```
src/
  data/
    products.ts     the catalog: sizes, finishes, options, presets, copy (km + en)
    materials.ts    shared material library
    rules.ts        sizing rules shared by data and 3D (seats, doors, mattress sizes)
    config.ts       defaults, validation, pricing, lead time, share-link encoding
    bag.ts          totals, delivery, promo
  three/
    builders.ts     one parametric builder per furniture family
    studio.ts       renderer, lights, camera fitting, stills, technical drawings
    materials.ts    material -> PBR texture mapping
  components/, pages/, lib/, i18n/
```

### Adding a product

1. Add an entry to `PRODUCTS` in `src/data/products.ts` (copy a similar one). Pick a `kind` (and `variant`) that already has a builder.
2. Give it size ranges, a default, presets, slots (material ids from `materials.ts`) and options.
3. Run `npm test`. The tests check that every default and preset is valid, the default build costs the base price, and the 3D model's measured size matches the requested size for every option value.

A new furniture *family* needs a builder in `src/three/builders.ts` and a case in `buildFurniture`.

### Things to review

- Prices for the 13 new pieces and the surcharge curve (`sizeCurve`, `TIER_PREMIUM`) are placeholders, so set your real numbers.
- Khmer copy was written for this project; have a native speaker review it, especially product names and the checkout text.
- The riel rate is a constant (`KHR_PER_USD` in `src/i18n/translations.ts`).
- The 3D models are stylised procedural furniture, not photographic. For hero imagery you will still want product photos.

## License

MIT — see [LICENSE](LICENSE). Change the copyright holder to whatever entity owns the brand before you publish.
