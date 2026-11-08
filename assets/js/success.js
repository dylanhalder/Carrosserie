/* Order confirmation: clear the bag and personalise the message. */
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  const msg = document.querySelector("[data-success-msg]");
  const ref = document.querySelector("[data-success-ref]");
  const hadPlan = params.has("club") || !!window.TSK.Cart.plan();

  if (hadPlan) {
    msg.textContent = "Welcome to the sticky kind club! Your receipt and membership details are on their way. Your first sheet ships on the 1st.";
  }
  const sid = params.get("session_id");
  if (sid) {
    // Optional: GET /api/checkout-session?id=… to show the order summary.
    ref.textContent = `Order reference: ${sid.slice(-10).toUpperCase()}`;
  } else if (params.has("demo")) {
    ref.textContent = "(Demo order, no payment was taken.)";
  }

  window.TSK.Cart.clear();
})();
