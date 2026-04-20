# Design System

## Direction

**Personality:** Precision & Density  
**Foundation:** neutral  
**Depth:** borders-only

## Tokens

### Spacing
Base: 4px  
Scale: 4, 8, 12, 16, 24, 32, 48, 64

### Colors
```
--background: #101010
--surface: #141414
--foreground: #f1eee7
--secondary: #a9a49a
--muted: #7a766d
--border: rgba(255,255,255,0.12)
--border-strong: rgba(255,255,255,0.22)
--accent: #8abd6e
```

### Radius
Scale: 0px, 2px, 4px

### Typography
Font: display + mono  
Scale: 11, 12, 13, 14, 18, 24, 40, 72  
Weights: 400, 500, 600

## Patterns

### Shell
- Rail width: 60px
- Header height: 52px
- Borders define every major region
- Active navigation never uses full white fill

### Dashboard
- Hero is the main visual anchor
- One action per region
- Cards use terse labels and clear values
- Logs and metrics occupy the lower half

## Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Keep the Monolith grid as the primary identity | The product needs a strong visual signature instead of a generic admin dashboard. | 2026-04-13 |
| Use vLLM-style restraint, not vLLM layout | The user wants minimal density and calm spacing without losing the Monolith shell. | 2026-04-13 |
| Favor user-facing labels over fictional IDs | The screen should remain understandable outside the design reference. | 2026-04-13 |
