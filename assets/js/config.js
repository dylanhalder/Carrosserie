/* ==========================================================================
   The Sticky Kind — store config
   --------------------------------------------------------------------------
   Everything you'd change month to month lives here: the current drop,
   products, club plans, shipping rules and the Stripe placeholders.

   Prices are in CENTS (900 = $9.00). They are for DISPLAY ONLY — the real
   amount charged always comes from the Stripe Price IDs on the server
   (see /api/create-checkout-session.js). Keep the two in sync.
   ========================================================================== */
window.STICKY = {
  currency: "USD",
  locale: "en-US",

  /* ---- Stripe ---------------------------------------------------------- */
  stripe: {
    // Publishable key (safe to expose). Only needed if you switch to
    // Stripe Embedded Checkout / Elements — hosted Checkout doesn't need it.
    publishableKey: "pk_test_REPLACE_ME",
    // Serverless endpoint that creates a Checkout Session and returns { url }.
    checkoutEndpoint: "/api/create-checkout-session",
    // No-code customer portal login link (Stripe Dashboard → Settings →
    // Billing → Customer portal → "Login link"). Members manage / pause /
    // cancel their club membership here.
    customerPortalUrl: "https://billing.stripe.com/p/login/REPLACE_ME",
  },

  // When true, checkout skips Stripe and fakes a successful order.
  // Auto-enabled while the publishable key above is still a placeholder.
  get demoMode() {
    return /REPLACE_ME/.test(this.stripe.publishableKey);
  },

  /* ---- This month's drop ----------------------------------------------- */
  drop: {
    number: 12,
    title: "Home for the Holidays",
    month: "December 2026",
    // Last moment to join and still get this sheet (ISO, with timezone).
    cutoff: "2026-11-25T23:59:00-08:00",
    shipDate: "Dec 1",
  },

  /* ---- Shipping (must match the Stripe shipping rates on the server) --- */
  shipping: {
    regions: {
      US: { label: "United States", flat: 200, freeOver: 2500 },
      CA: { label: "Canada", flat: 500, freeOver: 4000 },
      INTL: { label: "Everywhere else", flat: 700, freeOver: 5000 },
    },
    // Anything in the same order as a club membership ships free with
    // the first sheet.
    freeWithClub: true,
  },

  /* ---- One-off products ------------------------------------------------ */
  products: {
    "sheet-012": {
      name: "Drop No. 12 — full sheet",
      blurb: "The whole Home for the Holidays sheet. 5 × 7 in, 10 stickers.",
      price: 1200,
      img: "assets/img/stickers/cottage.png",
      tags: ["sheet", "holiday"],
      badge: "limited",
    },
    "stk-sweater": {
      name: "Grandma's Sweater",
      blurb: "Fair-isle knit, extra cozy. 3 in.",
      price: 350,
      img: "assets/img/stickers/sweater.png",
      tags: ["single", "cozy", "holiday"],
    },
    "stk-bow": {
      name: "The Good Ribbon",
      blurb: "The one you save and reuse every year. 3 in.",
      price: 350,
      img: "assets/img/stickers/bow.png",
      tags: ["single", "cozy"],
    },
    "stk-cinnamon": {
      name: "Cinnamon, Obviously",
      blurb: "A shaker jar, half full (optimist). 3 in.",
      price: 350,
      img: "assets/img/stickers/cinnamon.png",
      tags: ["single", "cozy", "holiday"],
    },
    "stk-cottage": {
      name: "Chimney Cottage Badge",
      blurb: "Our little house, smoke and all. 3.5 in oval.",
      price: 400,
      img: "assets/img/stickers/cottage.png",
      tags: ["single", "badge"],
    },
    "stk-santa": {
      name: "Mr. Claus, Sketched",
      blurb: "Clean line-art Santa on clear-white vinyl. 3 in.",
      price: 350,
      img: "assets/img/stickers/santa.png",
      tags: ["single", "holiday"],
    },
    "pack-holiday": {
      name: "Holiday Five-Pack",
      blurb: "All five singles from this drop, bundled. Save $4.",
      price: 1400,
      img: "assets/img/stickers/santa.png",
      tags: ["pack", "holiday"],
      badge: "save $4",
    },
  },

  /* ---- Club plans (subscriptions) -------------------------------------- */
  plans: {
    "club-monthly": {
      name: "The Sticky Kind Club — monthly",
      short: "Monthly",
      price: 900,
      interval: "month",
      perMonth: 900,
      img: "assets/img/stickers/bow.png",
    },
    "club-quarterly": {
      name: "The Sticky Kind Club — every 3 months",
      short: "3 months",
      price: 2500,
      interval: "3 months",
      perMonth: 833,
      img: "assets/img/stickers/sweater.png",
    },
    "club-yearly": {
      name: "The Sticky Kind Club — yearly",
      short: "12 months",
      price: 9600,
      interval: "year",
      perMonth: 800,
      img: "assets/img/stickers/santa.png",
    },
  },
};
