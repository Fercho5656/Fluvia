# Design System Documentation



## 1. Creative North Star: The Infrastructure Architect

This design system is built to feel like high-end engineering—precise, authoritative, yet effortlessly fluid. We are moving away from the "generic SaaS" look of flat cards and heavy borders. Instead, we embrace **The Infrastructure Architect**—an editorial-grade aesthetic that treats digital interfaces like architectural blueprints. We use intentional asymmetry, massive typographic contrast, and tonal depth to create an environment that feels "developer-first" without sacrificing the premium polish required by elite agencies.



## 2. Color & Tonal Depth

The palette is rooted in absolute depth. By using a deep black (`#131313`) as our foundation, the vibrant electric blue (`#0052FF`) becomes a functional beacon rather than just a decorative element.



### The "No-Line" Rule

**Prohibit 1px solid borders for sectioning.** Traditional lines clutter the UI. Boundaries must be defined through background color shifts. For example, a `surface-container-low` section should sit directly on a `surface` background to define its start and end.



### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers. Use the `surface-container` tiers to create "nested" depth:

- **Base:** `surface` (#131313)

- **Deep Inset:** `surface-container-lowest` (#0E0E0E) for code blocks or data-heavy zones.

- **Primary Card:** `surface-container-low` (#1B1B1B).

- **Elevated Overlay:** `surface-container-highest` (#353535) for active states or modals.



### The "Glass & Gradient" Rule

To escape the "flat" look, floating elements (dropdowns, tooltips, navigation) must utilize **Glassmorphism**. Use semi-transparent surface colors with a `backdrop-blur` of 12px–20px.

- **Signature Texture:** For primary CTAs and hero highlights, use a linear gradient from `primary_container` (#0052FF) to `inverse_primary` (#004CED) at a 135-degree angle. This adds "soul" and dimension to the electric blue.



## 3. Typography

We employ a high-contrast typographic scale to mirror technical documentation and editorial magazines.



- **Display & Headlines (Manrope):** Use Manrope for all `display` and `headline` levels. Its geometric construction feels modern and "engineered." Large-scale headlines should use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) to command attention.

- **Body & Labels (Inter):** Use Inter for all functional text. It is the gold standard for legibility in developer environments.

- **The Hierarchy Strategy:** Create "tension" by pairing a massive `display-md` headline with a tiny, all-caps `label-md` uppercase tag above it. This communicates a high-end, curated feel.



## 4. Elevation & Depth: Tonal Layering

Traditional shadows are often a crutch for poor contrast. In this system, hierarchy is achieved through **Tonal Layering**.



### The Layering Principle

Depth is achieved by "stacking" the surface-container tiers. Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural lift. This mimics the way light hits physical materials in a dark room.



### Ambient Shadows

When a "floating" effect is required (e.g., a modal or a primary action button), use **Ambient Shadows**:

- **Blur:** 32px–64px.

- **Opacity:** 4%–8%.

- **Tint:** The shadow color must be a tinted version of `on_surface` (light grey) rather than pure black, creating a "glow" rather than a "drop shadow."



### The "Ghost Border" Fallback

If a border is absolutely necessary for accessibility (e.g., input fields), use the **Ghost Border**:

- **Token:** `outline_variant` (#434656).

- **Opacity:** 10%–20% maximum.

- **Constraint:** Explicitly forbid 100% opaque, high-contrast borders.



## 5. Components



### Buttons

- **Primary:** Gradient fill (`primary_container` to `inverse_primary`). Roundedness: `DEFAULT` (0.5rem). Use `label-md` for text, all-caps with 0.05em tracking.

- **Secondary:** Glassmorphic background. Semi-transparent `surface_variant` with a 1px `Ghost Border`.

- **Tertiary:** Ghost style. No background; `on_surface` text. Use for low-priority actions like "Cancel."



### Cards & Lists

**Strict Rule:** No divider lines.

- Use vertical white space from the Spacing Scale (specifically `8`, `10`, or `12`) to separate items.

- For list items, use a hover state that shifts the background to `surface_container_high` to indicate interactivity.

- **Infrastructure Cards:** Use a 12px corner radius (`md`) and a subtle `surface_container_low` fill to differentiate from the base background.



### Input Fields

- **Background:** `surface_container_highest` at 40% opacity.

- **State:** On focus, the `Ghost Border` should transition to 100% opacity of the `primary` token (#B7C4FF).

- **Helper Text:** Always use `body-sm` in `on_surface_variant` to maintain a clean, developer-friendly look.



### Chips (Badges)

- Use `surface_container_highest` for the background with `primary` text for "Active" states.

- Shape: `full` (9999px) for a "pill" aesthetic that breaks up the rectangular grid of cards.



## 6. Do's and Don'ts



### Do

- **Embrace Asymmetry:** Align text to the left but allow imagery or code blocks to bleed off the grid or sit offset to create visual interest.

- **Use "Breathing Room":** If a section feels crowded, double the spacing (e.g., move from `10` to `20` on the Spacing Scale).

- **Layer Surface Tones:** Use the difference between `surface_dim` and `surface_bright` to guide the eye toward the most important content.



### Don't

- **Don't use 100% white (#FFFFFF) for text:** Use `on_surface` (#E2E2E2). Pure white on pure black causes "halation" (eye strain).

- **Don't use standard drop shadows:** Avoid the "fuzzy black cloud" look. If it doesn't look like ambient light, remove it.

- **Don't use dividers:** If you feel the need to add a line, try adding 16px of extra padding instead.

- **Don't crowd the logo:** The logo should always sit on the `surface` base, never on a container, to maintain its "Infrastructure Architect" authority.