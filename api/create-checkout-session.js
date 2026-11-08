/* ==========================================================================
   POST /api/create-checkout-session
   Serverless function (works as-is on Vercel; trivial to port to Netlify /
   Cloudflare / Express). Creates a Stripe Checkout Session and returns { url }.

   SECURITY: never trust prices from the browser. The client sends only
   product IDs + quantities; we map them to Stripe Price IDs here.
   ========================================================================== */
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_REPLACE_ME");
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

/* Map site IDs (assets/js/config.js) → Stripe Price IDs.
   Create these in Stripe Dashboard → Product catalog, then paste the IDs
   into your environment variables (see .env.example). */
const CATALOG = {
  // one-off products (Price type: one-time)
  "sheet-012": { price: process.env.PRICE_SHEET_012, recurring: false },
  "stk-sweater": { price: process.env.PRICE_STK_SWEATER, recurring: false },
  "stk-bow": { price: process.env.PRICE_STK_BOW, recurring: false },
  "stk-cinnamon": { price: process.env.PRICE_STK_CINNAMON, recurring: false },
  "stk-cottage": { price: process.env.PRICE_STK_COTTAGE, recurring: false },
  "stk-santa": { price: process.env.PRICE_STK_SANTA, recurring: false },
  "pack-holiday": { price: process.env.PRICE_PACK_HOLIDAY, recurring: false },
  // club plans (Price type: recurring, monthly / every 3 months / yearly)
  "club-monthly": { price: process.env.PRICE_CLUB_MONTHLY, recurring: true },
  "club-quarterly": { price: process.env.PRICE_CLUB_QUARTERLY, recurring: true },
  "club-yearly": { price: process.env.PRICE_CLUB_YEARLY, recurring: true },
};

/* Shipping rates (Dashboard → Product catalog → Shipping rates).
   Must mirror STICKY.shipping in config.js. Only used in "payment" mode;
   club orders ship free in the US. */
const SHIPPING = {
  US: { rate: process.env.SHIPPING_RATE_US, free: process.env.SHIPPING_RATE_FREE, freeOver: 2500 },
  CA: { rate: process.env.SHIPPING_RATE_CA, free: process.env.SHIPPING_RATE_FREE, freeOver: 4000 },
  INTL: { rate: process.env.SHIPPING_RATE_INTL, free: process.env.SHIPPING_RATE_FREE, freeOver: 5000 },
};
// Recurring shipping fee added to club memberships outside the US.
const CLUB_SHIPPING = { CA: process.env.PRICE_CLUB_SHIPPING_CA, INTL: process.env.PRICE_CLUB_SHIPPING_INTL };

const regionFor = (country) => (country === "US" ? "US" : country === "CA" ? "CA" : "INTL");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { items = [], email, shipping, gift = {}, promoCode, marketing } = body;

    // ---- Validate --------------------------------------------------------
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
    if (!shipping?.address?.line1 || !shipping?.address?.country) return res.status(400).json({ error: "Please add a shipping address." });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "Your bag is empty." });

    const lines = [];
    let recurringCount = 0;
    for (const { id, qty } of items) {
      const entry = CATALOG[id];
      const quantity = Math.max(1, Math.min(20, parseInt(qty, 10) || 1));
      if (!entry || !entry.price) return res.status(400).json({ error: `Unknown item: ${id}` });
      if (entry.recurring) recurringCount++;
      lines.push({ price: entry.price, quantity: entry.recurring ? 1 : quantity, recurring: entry.recurring });
    }
    if (recurringCount > 1) return res.status(400).json({ error: "Only one club membership per order." });

    const isSubscription = recurringCount === 1;
    const region = regionFor(shipping.address.country);

    // ---- Customer (prefilled with shipping so Stripe doesn't ask again) --
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customerData = {
      email,
      name: shipping.name,
      shipping: { name: shipping.name, address: shipping.address },
      metadata: { marketing_opt_in: String(!!marketing) },
    };
    const customer = existing.data[0]
      ? await stripe.customers.update(existing.data[0].id, customerData)
      : await stripe.customers.create(customerData);

    // ---- Session params --------------------------------------------------
    const line_items = lines.map(({ price, quantity }) => ({ price, quantity }));
    if (isSubscription && region !== "US" && CLUB_SHIPPING[region]) {
      line_items.push({ price: CLUB_SHIPPING[region], quantity: 1 }); // recurring shipping
    }

    const metadata = {
      is_gift: String(!!gift.isGift),
      gift_note: (gift.note || "").slice(0, 200),
      ship_country: shipping.address.country,
    };

    const params = {
      mode: isSubscription ? "subscription" : "payment",
      customer: customer.id,
      line_items,
      metadata,
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout.html?canceled=1`,
      billing_address_collection: "auto",
      customer_update: { shipping: "auto", address: "auto" },
      // Stripe Tax: enable in Dashboard first, then flip this on.
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
      // Requires a Terms of Service URL in Dashboard → Settings → Public details.
      consent_collection: { terms_of_service: "required" },
    };

    // Discounts: resolve a typed code server-side, otherwise let shoppers enter one on Stripe.
    if (promoCode) {
      const promo = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
      if (promo.data[0]) params.discounts = [{ promotion_code: promo.data[0].id }];
      else params.allow_promotion_codes = true;
    } else {
      params.allow_promotion_codes = true;
    }

    if (isSubscription) {
      // One-off items in the same order are added to the first invoice and ship with the first sheet.
      params.subscription_data = { metadata };
    } else {
      const subtotal = await estimateSubtotal(lines);
      const s = SHIPPING[region];
      const rate = subtotal >= s.freeOver ? s.free : s.rate;
      if (rate) params.shipping_options = [{ shipping_rate: rate }];
      params.payment_intent_data = { metadata, shipping: { name: shipping.name, address: shipping.address } };
    }

    const session = await stripe.checkout.sessions.create(params);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    return res.status(500).json({ error: "Something went wrong starting checkout." });
  }
};

// Look up real unit amounts from Stripe to decide free shipping.
async function estimateSubtotal(lines) {
  const prices = await Promise.all(lines.map((l) => stripe.prices.retrieve(l.price)));
  return prices.reduce((sum, p, i) => sum + (p.unit_amount || 0) * lines[i].quantity, 0);
}
