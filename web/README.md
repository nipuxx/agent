# Nipux Web

This is the browser UI for Nipux.

It is intentionally separate from the daemon:

- the UI renders machine state, a setup-first onboarding flow, chat surfaces, and agent views
- the daemon owns hardware detection, runtime selection, install planning, and Hermes bridging

## Development

```bash
cd web
npm install
npm run dev
```

By default the UI expects `nipuxd` on:

```text
http://127.0.0.1:9384
```

Override with:

```bash
NEXT_PUBLIC_NIPUXD_URL=http://<host>:9384 npm run dev
```

## Visual Direction

The UI uses a minimal dark neutral palette and shadcn-style primitives instead of decorative gradients.
It is meant to feel closer to a local control panel than a marketing page.
