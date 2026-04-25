# Nipux Theme System

Themes are intentionally split into two small edit surfaces:

- `web/src/app/globals.css` controls the real visual system through CSS variables.
- `web/src/lib/themes.ts` controls theme labels, descriptions, and picker previews.

For visual changes, edit the matching `:root[data-theme="..."]` block in `globals.css` first. The important geometry tokens are:

- `--rail-width`
- `--radius-panel`
- `--radius-card`
- `--radius-control`
- `--page-padding`
- `--panel-padding`
- `--control-height`
- `--panel-bg`
- `--card-bg`
- `--field-bg`
- `--panel-shadow`
- `--panel-blur`
- `--heading-transform`
- `--heading-letter-spacing`
- `--label-letter-spacing`

The shared component classes are:

- `nipux-panel`
- `nipux-card`
- `nipux-control`
- `nipux-frame`
- `nipux-title`
- `nipux-label`
- `nipux-theme-tile`

Avoid adding theme-specific conditionals in React components unless a theme needs a real layout exception. Most changes should be token-only.
