# The Sticky Kind: storefront

A mobile-first static storefront for **The Sticky Kind**, a monthly sticker sheet club plus shop. Plain HTML/CSS/JS with no build step, plus two serverless functions for Stripe.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Home: hero for the monthly drop and theme, cutoff countdown, how it works, lineup, club teaser, shop picks, newsletter |
| `drop.html` | This month's drop in detail: sheet, buy box (club vs. one-off), each sticker, specs, timeline, sticky mobile CTA |
| `club.html` | The club: plans (monthly / 3-month / yearly), perks, gifting, FAQ, link to manage membership |
| `shop.html` | Singles, sheets and packs with filter chips |
| `info.html` | About, monthly rhythm, sticker care, shipping table, FAQ, contact form |
| `checkout.html` | Bag summary, contact and shipping, gift note, promo code, auto-renew consent, hands off to Stripe |
| `success.html` | Order confirmation (clears the bag) |
| `privacy.html`, `terms.html`, `shipping.html`, `accessibility.html` | Legal pages. Terms include the subscription and auto-renewal terms. |
| `404.html` | Not found |

There's also a cart drawer, a cookie consent banner (essential vs. analytics), and the header and footer on every page.

## Run it locally

```bash
npm run dev        # serves on http://localhost:3000
```

Checkout runs in **demo mode** (no charges, goes straight to the success page) while `stripe.publishableKey` in `assets/js/config.js` still contains `REPLACE_ME`.

## Each month: new drop

1. Add the new sticker PNGs to `assets/img/stickers/`. Die-cut PNGs with a transparent background work best.
2. Update `drop` and `products` in `assets/js/config.js`. The countdown reads `drop.cutoff`.
3. Update the drop copy in `index.html`, `drop.html` and the announcement bar at the top of each page.
4. Create the new Stripe prices and add their IDs to the server catalog (below).

## Going live with Stripe

1. **Products & prices** (Stripe Dashboard → Product catalog)
   - One-time prices for each sheet, single and pack.
   - Recurring prices for the club: monthly, every 3 months, yearly.
   - Shipping rates for US, Canada, international and free.
2. **Environment variables**: copy `.env.example` and fill it in on your host (Vercel works out of the box with the `/api` folder).
3. **Webhook**: add `https://YOURDOMAIN/api/stripe-webhook` for `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed` and `customer.subscription.deleted`, then set `STRIPE_WEBHOOK_SECRET`. The handler has TODOs for your packing list and email list.
4. **Customer portal**: turn it on (Settings → Billing → Customer portal), allow cancel/pause, and paste the login link into `stripe.customerPortalUrl` in `config.js`.
5. **Terms URL**: set your Terms of Service URL in Settings → Public details. Checkout requires ToS consent.
6. Replace `pk_test_REPLACE_ME` in `config.js`. This turns off demo mode.

How it works: the browser sends only item IDs and quantities. `api/create-checkout-session.js` maps them to your Stripe Price IDs, so prices can't be tampered with. It creates or updates the customer with the shipping address, then opens Checkout in `subscription` mode if a club plan is in the bag (other items go on the first invoice) or `payment` mode otherwise.

## Before launch, replace these placeholders

- Prices, shipping rates and plan perks. These are suggestions, so check them against your real costs.
- `hello@thestickykind.com`, social links, and the yellow-highlighted `[placeholders]` in the legal pages. The legal pages are templates, not legal advice; get them reviewed for your location.
- The "About" story and photo on `info.html`.
- Newsletter and contact forms. They currently show a thank-you toast; look for the `TODO`s in `assets/js/main.js`.
- Analytics: load your script where the cookie banner records consent (`main.js`).
- Header and footer markup is repeated in each HTML file, so change nav links in every page.
