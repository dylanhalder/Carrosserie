/* ==========================================================================
   The Sticky Kind — checkout
   Renders the order summary and hands off to Stripe.

   STRIPE FLOW (default: hosted Checkout)
   1. POST { items, email, shipping, gift, promoCode, marketing } to
      STICKY.stripe.checkoutEndpoint  (see /api/create-checkout-session.js)
   2. Server re-prices everything from its own Stripe Price IDs, creates a
      Checkout Session (mode "subscription" if a club plan is in the bag,
      otherwise "payment") and responds with { url }.
   3. We redirect to that URL. Stripe sends the shopper back to
      success.html?session_id={CHECKOUT_SESSION_ID} or to this page on cancel.

   Want payment on this page instead? Swap step 3 for Embedded Checkout:
     const stripe = Stripe(STICKY.stripe.publishableKey);   // load https://js.stripe.com/v3
     const { clientSecret } = await res.json();             // server: ui_mode: "embedded"
     const checkout = await stripe.initEmbeddedCheckout({ clientSecret });
     checkout.mount("#payment-element");
   ========================================================================== */
(function () {
  "use strict";
  const C = window.STICKY;
  const { Cart, money, lineHTML, esc } = window.TSK;
  const $ = (s, el = document) => el.querySelector(s);

  const form = $("#checkout-form");
  const country = $("#co-country");
  const errBox = $("[data-error]");
  const payBtn = $("[data-pay]");

  if (C.demoMode) $("[data-demo-banner]").hidden = false;

  const region = () => country.selectedOptions[0]?.dataset.region || "US";

  function render() {
    const t = Cart.totals(region());
    const empty = t.lines.length === 0;
    $("[data-empty]").hidden = !empty;
    $("[data-checkout]").hidden = empty;
    if (empty) return;

    $("[data-sum-lines]").innerHTML = t.lines.map((l) => lineHTML(l)).join("");
    $("[data-sum-subtotal]").textContent = money(t.subtotal);
    $("[data-sum-region]").textContent = `(${t.region.label})`;
    $("[data-sum-shipping]").textContent =
      t.shipping === 0 ? (t.productsSubtotal ? "Free" : (t.plan && region() !== "US" ? "At payment" : "Free")) : money(t.shipping);
    $("[data-sum-total]").textContent = money(t.total);

    const rec = $("[data-sum-recurring]");
    const consent = $("[data-renew-consent]");
    if (t.plan) {
      rec.hidden = false;
      rec.innerHTML = `✶ <strong>${esc(t.plan.short)} club membership</strong>: ${money(t.plan.price)} today, then ${money(t.plan.price)} every ${esc(t.plan.interval)}. Cancel anytime.` +
        (region() !== "US" ? ` Club shipping outside the US is added at payment.` : "");
      consent.hidden = false;
      $("#co-renew").required = true;
      $("[data-renew-plan]").textContent = `${t.plan.short} club membership`;
      $("[data-renew-amount]").textContent = money(t.plan.price);
      $("[data-renew-interval]").textContent = t.plan.interval;
      payBtn.textContent = "Start my membership";
    } else {
      rec.hidden = true;
      consent.hidden = true;
      $("#co-renew").required = false;
      payBtn.textContent = `Pay ${money(t.total)} securely`;
    }
  }

  // Gift toggle
  const giftToggle = $("[data-gift-toggle]");
  giftToggle.addEventListener("change", () => {
    $("[data-gift-fields]").hidden = !giftToggle.checked;
    $("label[for=co-name]").textContent = giftToggle.checked ? "Recipient's full name" : "Full name";
  });

  country.addEventListener("change", render);
  document.addEventListener("cart:change", render);

  function showError(msg) {
    errBox.textContent = msg;
    errBox.classList.add("show");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.classList.remove("show");

    if (!form.checkValidity()) {
      const bad = form.querySelector(":invalid");
      bad?.focus();
      showError(bad?.type === "checkbox" ? "Please tick the required box to continue." : "Please fill in the highlighted fields.");
      form.querySelectorAll(":invalid").forEach((el) => el.setAttribute("aria-invalid", "true"));
      return;
    }

    const fd = new FormData(form);
    const payload = {
      items: Cart.items().map(({ id, qty }) => ({ id, qty })),
      email: fd.get("email").trim(),
      marketing: fd.get("marketing") === "on",
      shipping: {
        name: fd.get("name").trim(),
        address: {
          line1: fd.get("line1").trim(),
          line2: (fd.get("line2") || "").trim(),
          city: fd.get("city").trim(),
          state: (fd.get("state") || "").trim(),
          postal_code: fd.get("postal_code").trim(),
          country: fd.get("country"),
        },
      },
      gift: { isGift: fd.get("isGift") === "on", note: (fd.get("giftNote") || "").trim() },
      promoCode: (fd.get("promoCode") || "").trim().toUpperCase(),
    };

    payBtn.classList.add("loading");
    payBtn.disabled = true;

    try {
      if (C.demoMode) {
        // ── DEMO: pretend Stripe said yes ──────────────────────────────
        await new Promise((r) => setTimeout(r, 900));
        window.location.href = "success.html?demo=1" + (Cart.plan() ? "&club=1" : "");
        return;
      }

      // ── LIVE: create a Stripe Checkout Session on the server ─────────
      const res = await fetch(C.stripe.checkoutEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "We couldn't start checkout.");
      window.location.href = data.url; // → Stripe hosted Checkout
    } catch (err) {
      showError(`${err.message} Please try again, or email hello@thestickykind.com if it keeps happening.`);
      payBtn.classList.remove("loading");
      payBtn.disabled = false;
    }
  });

  // If the shopper came back from Stripe via cancel_url
  if (new URLSearchParams(location.search).has("canceled")) {
    window.TSK.toast("Payment canceled. Your bag is still here.");
  }

  render();
})();
