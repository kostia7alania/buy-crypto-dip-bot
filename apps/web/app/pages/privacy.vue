<script setup lang="ts">
useSeoMeta({
  title: "Privacy and Retention",
  description:
    "Phase-aware browser, analytics and Telegram data practices for the current self-hosted DRY_RUN product.",
});
</script>

<template>
  <PolicyPage
    eyebrow="Reviewed 2 August 2026"
    title="Privacy and retention"
    lede="This notice describes the current self-hosted DRY_RUN build. The person operating an installation controls its database, logs, Telegram bot and optional analytics configuration and must publish deployment-specific contacts and retention choices."
  >
    <section>
      <h2>Browser session</h2>
      <p>
        Telegram Login can create a sealed, Secure, HttpOnly, same-site browser
        cookie. The API stores only a SHA-256 session-token fingerprint, an idle
        timestamp, absolute expiry, session kind and revocation state. Sessions
        have a seven-day idle limit, a thirty-day absolute limit and a seven-day
        investigation grace before expired/revoked cleanup.
      </p>
    </section>

    <section>
      <h2>Optional analytics</h2>
      <p>
        Google Analytics is default-off and is not loaded for a placeholder
        configuration. When a real measurement ID is configured, page-level
        analytics loads only after explicit consent. The consent preference is
        stored locally in the browser and a persistent settings control can
        disable future collection.
      </p>
      <p>
        The analytics contract excludes Telegram identity, session values,
        strategy configuration, symbols, orders, portfolio values, audit
        payloads, credentials, signatures and free-form financial content.
        Google is the third-party processor after consent. Provider-side
        retention is not controlled by this repository and must be configured
        and disclosed by the operator before enabling analytics.
      </p>
    </section>

    <section>
      <h2>Telegram identity and notifications</h2>
      <p>
        Telegram supplies the signed Login presentation and, separately, the
        private-chat actor used by the bot. A web login does not enable message
        delivery. Private <code>/start</code> stores the Telegram user/chat
        binding and notification-enabled time. The durable outbox stores the
        minimum current message/delivery facts needed for retry and audit.
      </p>
      <p>
        Login-presentation fingerprints expire after five minutes. Outbox and
        audit-history deletion retention is not yet automated, so an operator
        must not promise a deletion period the code does not enforce. There is
        intentionally no HTTP endpoint that deletes or truncates audit history.
      </p>
    </section>

    <section>
      <h2>Access, correction and deletion</h2>
      <p>
        Session inventory and revoke-one/revoke-all are available to the signed
        in user. A self-service account export, correction and deletion flow is
        not shipped. For a hosted deployment, those flows, the controller
        contact, verified request procedure, statutory exceptions and enforced
        retention schedule are prerequisites—not promises made by this build.
      </p>
    </section>

    <section>
      <h2>Future phases are separate</h2>
      <p>
        Hosted SaaS and private exchange connectivity are not offered. Future
        phases would introduce additional controller/processor, billing,
        support, credential, order, execution, reconciliation and incident data
        categories. They require a new reviewed notice before collection; this
        notice does not authorize them.
      </p>
    </section>
  </PolicyPage>
</template>
