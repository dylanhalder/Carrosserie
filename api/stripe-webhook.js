/* ==========================================================================
   POST /api/stripe-webhook
   Stripe → your server notifications. Add the endpoint in
   Dashboard → Developers → Webhooks, and put the signing secret in
   STRIPE_WEBHOOK_SECRET. Locally:  stripe listen --forward-to localhost:3000/api/stripe-webhook
   ========================================================================== */
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_REPLACE_ME");

// Signature verification needs the raw, unparsed body.
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] bad signature", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // TODO: add to your packing list (Google Sheet, Airtable, Notion, ShipStation…)
      //  - session.customer, session.customer_details.email
      //  - session.metadata.is_gift / gift_note
      //  - line items: stripe.checkout.sessions.listLineItems(session.id)
      // TODO: if customer opted into marketing, add them to your email list.
      console.log("[webhook] new order", session.id, session.mode);
      break;
    }
    case "invoice.paid": {
      // A club renewal went through → include this member in next mailing.
      const invoice = event.data.object;
      console.log("[webhook] renewal paid", invoice.customer, invoice.subscription);
      break;
    }
    case "invoice.payment_failed": {
      // Stripe retries automatically (Smart Retries). Optionally email the member.
      console.log("[webhook] payment failed", event.data.object.customer);
      break;
    }
    case "customer.subscription.deleted": {
      // Membership ended → remove from future mailing list.
      console.log("[webhook] membership ended", event.data.object.customer);
      break;
    }
    default:
      break;
  }

  return res.status(200).json({ received: true });
};

// Tell Vercel/Next-style runtimes not to parse the body.
module.exports.config = { api: { bodyParser: false } };
