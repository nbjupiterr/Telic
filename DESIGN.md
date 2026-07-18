---
name: "Telic Product Website"
theme: "dark-monochrome"
text-case: "selective-uppercase"
grid:
  columns: 12
  container-max: "1180px"
  border-color: "#262626"
  border-width: "1px"
  continuous: false
colors:
  background: "#090909"
  background-deep: "#050505"
  surface: "#111111"
  surface-raised: "#171717"
  surface-hover: "#1C1C1C"
  foreground: "#F5F5F2"
  text-primary: "#F5F5F2"
  text-muted: "#A3A3A3"
  text-dim: "#858585"
  border: "#262626"
  border-strong: "#3A3A3A"
  accent: "#F5F5F2"
  accent-contrast: "#090909"
  code-bg: "#070707"
  code-text: "#D8D8D4"
typography:
  display:
    family: "Manrope Variable"
    size: "clamp(3.25rem, 7vw, 6.75rem)"
    weight: 650
    tracking: "-0.055em"
    leading: 0.94
  section:
    family: "Manrope Variable"
    size: "clamp(2.25rem, 4.4vw, 4.5rem)"
    weight: 580
    tracking: "-0.045em"
    leading: 1
  body:
    family: "Manrope Variable"
    size: "1rem"
    weight: 420
    leading: 1.7
  meta:
    family: "IBM Plex Mono"
    size: "0.6875rem"
    weight: 500
    tracking: "0.12em"
    transform: "uppercase"
  code:
    family: "IBM Plex Mono"
    size: "0.8125rem"
    weight: 400
spacing:
  section-padding-desktop: "112px"
  section-padding-tablet: "88px"
  section-padding-mobile: "72px"
  container-inline-desktop: "32px"
  container-inline-mobile: "20px"
  element-gap: "24px"
  cell-inset: "24px"
  hero-heading-gap: "28px"
shape:
  radius-small: "8px"
  radius-medium: "12px"
  radius-large: "16px"
  button-height: "46px"
  border-width: "1px"
effects:
  texture: "none"
  texture-opacity: 0
  ambient: "none"
  vignette: false
  gradients: false
  glow: false
  blur-panels: false
  shadow: "0 24px 80px rgba(0, 0, 0, 0.34)"
  section-transitions: "hairline-divider"
  scroll-reveal: false
  scroll-reveal-duration: "0.45s"
  scroll-reveal-easing: "cubic-bezier(0.16, 1, 0.3, 1)"
compositing:
  enabled: false
  layers:
    - type: "solid-background"
      z: 0
      color: "#090909"
hero:
  layout: "centered-statement"
  focal-point: "headline, center"
  content-max: "880px"
  illustration-method: "product-interface"
  product-frame-ratio: "16:9"
  product-frame-max: "1120px"
showcase:
  type: "product-interface"
  layout: "single-wide-frame"
  frame-background: "#111111"
  frame-border: "#262626"
  frame-radius: "16px"
interactive:
  theme-toggle: false
  copy-buttons: true
  hover-style: "solid-contrast-shift"
  more-details: "accordion"
  motion-distance: "6px"
  motion-duration: "180ms"
responsive:
  mobile: "320px-767px"
  tablet: "768px-1023px"
  desktop: "1024px+"
  collapse-at: "768px"
  feature-layout-desktop: "asymmetric 7/5 split"
  feature-layout-mobile: "single column"
---

# Reference analysis

## Direction retained

- The Kiro reference uses one centered statement, restrained navigation, a large
  product frame, and generous empty space.
- Product UI is the visual proof. Decorative illustration does not compete with
  the message.
- Sections use strong hierarchy: headline, short explanation, then one clear
  visual or structured group.
- Cards are dark, solid, and separated by fine borders instead of glass effects.

## Direction rejected

- No cyan, electric blue, purple, or neon status colors.
- No blue-black background cast.
- No radial gradients, glowing orbits, light streaks, grain, or floating blobs.
- No glassmorphism or repeated blurred panels.
- No equal three-column feature wall as the default layout.
- No fake metrics, customer logos, or unverified social proof.

# Design decisions

## Brand expression

Telic should feel like a serious developer instrument. The palette is deliberately
monochrome: tinted black, tinted white, and neutral grays. White is both the text
color and the only action accent. The design gets depth from spacing, border
contrast, typography, and product UI—not colored effects.

## Page composition

The homepage changes from a split hero to a centered statement with the Telic
workflow console directly beneath it. This mirrors the strongest reference: explain
the product in one sentence, then prove it with the interface.

Feature sections alternate between wide copy and narrow evidence blocks. The five
logical roles become a numbered editorial list with one active detail panel instead
of five competing cards. Installation remains its own page and keeps host-specific
tabs because that interaction serves a real task.

## Typography

Manrope provides a clean, human geometric voice without defaulting to the common
Inter/system-font appearance. IBM Plex Mono is reserved for commands, workflow
states, numbers, and small metadata. Paragraphs remain sentence case. Only labels,
status text, and navigation use uppercase.

## Motion

Motion is functional and quiet: short hover transitions, tab changes, menu movement,
and copy feedback. There are no entrance reveals or looping ambient animations.
`prefers-reduced-motion` removes all nonessential movement.

## Accessibility

- Text contrast must meet WCAG 2.2 AA.
- Interactive targets are at least 44 pixels tall.
- Focus uses a two-pixel off-white outline with a three-pixel offset.
- Horizontal interfaces become stacked content or explicitly focusable scroll
  regions on mobile.
- Meaning never depends on color.

# Component contract

## Header

- Height: `68px` desktop, `62px` mobile.
- Background: `#090909` at 96% opacity.
- Bottom border: `1px solid #262626`.
- Primary button: off-white fill with black text.

## Hero

- Centered content with maximum width `880px`.
- One headline, one supporting paragraph, two actions.
- Product frame begins `72px` below the actions.
- Remove the green status dot, colored gradient text, and both orbit elements.

## Product frame

- Background `#111111`, border `#262626`, radius `16px`.
- Workflow states use off-white, medium gray, and dim gray only.
- Active state is identified by border weight, fill, icon, and label—not hue.

## Sections

- Each major section begins after a full-width hairline divider.
- Section headings are left aligned except the hero and final call to action.
- Maximum paragraph width is `640px`.
- Large empty regions are intentional and must not be filled with decoration.

## Buttons

- Primary: `#F5F5F2` background, `#090909` text.
- Secondary: transparent background, `#3A3A3A` border, `#F5F5F2` text.
- Hover: primary becomes `#DCDCD8`; secondary becomes `#171717`.
- No gradients, glow, or colored shadows.

## Mobile

- Headline minimum size: `3.25rem`.
- All multi-column layouts collapse to one column.
- Product frames retain their hierarchy without scaling text below `0.6875rem`.
- Primary and secondary hero actions become full width below `480px`.
- No document-level horizontal overflow at `320px`.

# Acceptance checklist

- [ ] The rendered site contains no cyan, blue, purple, or neon UI colors.
- [ ] The background reads neutral black, not navy or blue-black.
- [ ] The homepage has one dominant focal point at every viewport.
- [ ] The product interface is the principal visual proof.
- [ ] No gradients, glow, orbit, grain, blur-panel, or decorative canvas remains.
- [ ] All four public routes remain responsive at 320, 390, 768, and 1440 pixels.
- [ ] Keyboard navigation, focus order, reduced motion, and copy feedback still work.
- [ ] Axe reports no serious or critical issues.
- [ ] Production build, repository tests, and adapter/plugin validation pass.
