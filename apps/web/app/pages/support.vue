<script setup lang="ts">
useSeoMeta({
  title: "Support and Security Reporting",
  description:
    "Current self-hosted support scope and private security-reporting path for Buy Crypto Dip Bot.",
});
</script>

<template>
  <PolicyPage
    eyebrow="Current operating scope"
    title="Support and security reporting"
    lede="This is a self-hosted DRY_RUN repository, not a hosted service. There is no paid support plan, uptime commitment, on-call team, status page or incident-notification SLA."
  >
    <section>
      <h2>Community support</h2>
      <p>
        Reproducible non-sensitive bugs and documentation problems can be
        reported through
        <a
          href="https://github.com/kostia7alania/buy-crypto-dip-bot/issues"
          rel="noopener noreferrer"
        >GitHub Issues</a>. Responses are best effort. Do not include tokens,
        cookies, Telegram payloads, database URLs, portfolio/order exports or
        other personal and financial data.
      </p>
    </section>

    <section>
      <h2>Private security reports</h2>
      <p>
        Suspected vulnerabilities should use the repository's
        <a
          href="https://github.com/kostia7alania/buy-crypto-dip-bot/security/advisories/new"
          rel="noopener noreferrer"
        >private security advisory form</a>, not a public issue. Include the
        affected revision, impact, safe reproduction and suggested mitigation;
        replace real secrets and personal data with synthetic values.
      </p>
    </section>

    <section>
      <h2>What support does not cover</h2>
      <ul>
        <li>investment, tax, legal or strategy-suitability advice;</li>
        <li>private exchange keys, Demo orders or live trading;</li>
        <li>custody, withdrawals, transfers, leverage or derivatives;</li>
        <li>operator-specific server, backup or Telegram availability;</li>
        <li>a recovery-time or response-time commitment.</li>
      </ul>
      <p>
        A future hosted product would require named operators, monitored
        readiness, incident communications, recovery drills, support capacity,
        an SLA decision and a public status channel before those are advertised.
      </p>
    </section>
  </PolicyPage>
</template>
