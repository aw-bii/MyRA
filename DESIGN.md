---
name: MyRA
description: Unified AI CLI desktop interface for analysts and researchers at Bertelsmann India Investment
colors:
  ink-blue: "#2563eb"
  ink-blue-deep: "#1d4ed8"
  ink-blue-ghost: "#dbeafe"
  danger: "#ef4444"
  danger-deep: "#dc2626"
  danger-muted: "#f87171"
  surface: "#ffffff"
  surface-subtle: "#f9fafb"
  surface-dark: "#111827"
  surface-darker: "#030712"
  bubble-light: "#f3f4f6"
  bubble-dark: "#1f2937"
  border-light: "#e5e7eb"
  border-subtle: "#d1d5db"
  border-dark: "#374151"
  text-primary: "#111827"
  text-primary-inv: "#f3f4f6"
  text-muted: "#9ca3af"
typography:
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-blue-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "4px 8px"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  conv-item-active:
    backgroundColor: "{colors.bubble-light}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  persona-item-active:
    backgroundColor: "{colors.ink-blue-ghost}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "8px"
---

# Design System: MyRA

## 1. Overview

**Creative North Star: "The Research Notebook"**

This system serves careful thinkers who arrive with a question and leave with an answer. Nothing about it signals "AI product" — no gradients, no pulsing orbs, no hero metrics. It reads like a well-kept research notebook: structured, consistent, and legible without effort. The interface's silence is intentional. The AI-generated content in the chat window is the product; the interface should be as unobtrusive as good paper.

The density is deliberately low, the palette is near-monochrome, and the only saturated element (Ink Blue, #2563eb) appears exclusively where action is required. Everything else steps back. Depth is expressed through tonal steps between surfaces, not through shadows or borders that compete with content. The system uses the platform-native font stack on purpose — it makes the tool feel native, not "web-ported."

The geometric language follows the Notion workspace reference: sober rectangularity rather than pill shapes. Corners are gently curved for warmth (8–16px depending on surface size) but never fully rounded. This is confidence through restraint, not playfulness through rounding. Similarly, body text holds a minimum 1.55 line-height — drawn from Notion's "generous body leading" doctrine — so reading long AI responses never feels cramped.

This system explicitly rejects: consumer AI product gloss (ChatGPT / Claude.ai web gradient language), feature-heavy sidebars (Notion AI or Copilot-in-Word conventions), generic SaaS dashboard patterns (hero metrics, identical card grids, colorful icon sets), and any decorative use of gradient text, glassmorphism, or animated loading states as primary visual expressions.

**Key Characteristics:**
- Near-monochrome neutral base; one deliberate chromatic accent (Ink Blue)
- Flat elevation throughout; depth via tonal surface layering only
- Two type sizes: 14px body, 12px label; hierarchy through weight, not scale
- Full dark mode; assumed primary working environment for many users
- Whitespace as signal, not waste — generous padding relative to content density
- Every interactive affordance immediately legible; nothing hidden, nothing extra

## 2. Colors: The Notebook Palette

A near-monochrome palette anchored in gray with a single deliberate chromatic note. When color appears, it means something.

### Primary

- **Ink Blue** (`#2563eb`): Primary actions exclusively — send button, new conversation, save, wizard progress fill. Used on no more than 10% of any screen surface. Its rarity is the point.
- **Ink Blue Deep** (`#1d4ed8`): Hover state on Ink Blue elements only. Never used as a first-state color.
- **Ink Blue Ghost** (`#dbeafe`): Selected-item background for persona list (light mode) and any active selection requiring a tinted area rather than a solid fill.

### Secondary

- **Danger** (`#ef4444`): The stop/abort action only. Appears in place of the send button while a response is streaming. Never decorative; its appearance means "something is in motion that can be interrupted."
- **Danger Deep** (`#dc2626`): Hover state on danger elements only.
- **Danger Muted** (`#f87171`): Destructive inline text affordances (delete labels within panels). Present but not alarming.

### Neutral

- **Surface White** (`#ffffff`): Main chat area (light mode); input field background; wizard modal card.
- **Surface Subtle** (`#f9fafb`): Sidebar background (light mode); full-screen wizard background.
- **Surface Dark** (`#111827`): Sidebar and panel backgrounds (dark mode); input background (dark mode).
- **Surface Darker** (`#030712`): App root and wizard page background (dark mode).
- **Bubble Light** (`#f3f4f6`): Assistant message bubble (light mode); list item hover background.
- **Bubble Dark** (`#1f2937`): Assistant message bubble (dark mode); list item hover background.
- **Border Light** (`#e5e7eb`): Dividers, panel separators, progress bar (unfilled), input strokes (light mode).
- **Border Subtle** (`#d1d5db`): Secondary input borders in light mode.
- **Border Dark** (`#374151`): All dividers and strokes in dark mode.
- **Text Primary** (`#111827`): Primary text in light mode.
- **Text Primary Inv** (`#f3f4f6`): Primary text in dark mode.
- **Text Muted** (`#9ca3af`): Timestamps, backend labels, metadata, subordinate UI copy.

### Named Rules

**The Ink Reserve Rule.** Ink Blue appears only on elements requiring immediate user action (buttons, progress indicators, active selections). It does not appear in decorative elements, text emphasis, or illustration. If a screen has no interactive element, it has no blue.

**The Two-Color Rule.** Ink Blue and Danger are the only chromatic colors in the system. Any proposal to add a third accent (status green, warning amber, info teal) must justify why tonal neutrals cannot carry the same meaning.

**The Semantic Tint Rule.** Ink Blue solid (`#2563eb`) signals action; Ink Blue Ghost (`#dbeafe`) signals selection state. These two meanings must never use the same tint. Per Apple HIG: "Don't use the same color to mean different things." The solid/ghost split is the enforced semantic boundary.

**The Muted Text Constraint.** Text Muted (`#9ca3af`) achieves approximately 2.85:1 contrast against Surface White (`#ffffff`) — below WCAG AA (4.5:1 for body text). It passes in dark mode (~5.6:1 on Surface Dark). Accordingly: use Text Muted only for 12px label-size text (timestamps, metadata, backend labels) in light mode — never for primary-information text. Provide a non-color signal (position, hierarchy, labeling) alongside any muted text that carries meaning. Do not apply `opacity: 0.5` on top of Text Muted; that compounds the contrast failure.

**The Color-Alone Prohibition.** No meaning may be communicated by color alone. Per Apple HIG inclusive color guidance: every color-coded state must be accompanied by a label, icon, or position cue. Danger actions use Danger Red AND carry a text label ("Stop", "Del"). Active states use Ink Blue Ghost AND are indicated by position in the list. This ensures legibility under color-blind conditions without reliance on color perception.

## 3. Typography

**Body / UI Font:** system-ui, -apple-system, BlinkMacSystemFont, sans-serif (platform native: SF Pro on macOS, Segoe UI on Windows)

**Character:** Quiet authority. No font personality to compete with content. The system uses the platform's own typeface to signal that this is a native tool, not a web application. Hierarchy is expressed through weight and spacing, not scale. Per the Apple HIG macOS type scale, body and headline can share the same size (13pt default) and be differentiated by weight alone — our Title and Body both at 14px with weight contrast follows this pattern intentionally.

### Hierarchy

- **Title** (semibold, 14px, line-height 1.4): Panel section headers ("Personas", sidebar app name "MyRA"). Appears once per panel at most. Never inside lists or message content.
- **Body** (regular, 14px, line-height 1.55): All message content, form labels, conversation list titles, button labels. The default voice of the interface.
- **Label** (regular, 12px, line-height 1.3): Timestamps, backend names, tag labels, secondary button text, wizard step copy, metadata rows in interface elements. In long AI-generated content, the prose system's own leading takes precedence.

### Named Rules

**The Two-Size Rule.** 14px (body) and 12px (label) are the only type sizes in the application shell. There is no display text, headline, or oversized number. When content needs emphasis, use weight (semibold) or spacing — not size escalation.

**The System Font Rule.** No font is fetched from a remote source. The system-ui stack renders the OS's native interface typeface. This is a deliberate choice that makes the tool feel at home on the desktop rather than web-ported. Do not load a web font for the application shell.

**The Generous Leading Rule.** Body text holds a minimum 1.55 line-height (per the Notion workspace reference). For AI-generated markdown content, the react-markdown prose system's own leading (typically 1.6–1.75) takes precedence — do not override it with tighter values. Dense text fatigues occasional users; give it room to breathe.

**The Leading Discipline Rule.** Leading is context-dependent, not one-size-fits-all. Interface elements (sidebar items, toolbar labels, button text) use tight leading (1.2–1.4): they are height-constrained and read in short bursts. Long content passages (AI responses, system prompts, persona descriptions) use loose leading (1.55+) to support sustained reading. Never apply tight leading to three or more lines of continuous prose.

**The Weight Range Rule.** Only Regular (400) and Semibold (600) weights are in use. Lighter weights (Ultralight, Thin, Light) are prohibited: per Apple HIG guidance, they reduce legibility at small sizes and in variable ambient light. When emphasis is needed, increase weight or spacing — not color or size.

## 4. Elevation

The system is flat by default. Depth is expressed entirely through tonal surface layering: the sidebar sits at a slightly more muted tone than the main area, assistant message bubbles are distinguished by a background step, and panel boundaries are marked by 1px border rules — not shadows.

The single exception is the setup wizard's modal card (`box-shadow: 0 20px 25px -5px rgba(0,0,0,.1), 0 8px 10px -6px rgba(0,0,0,.1)` — Tailwind `shadow-xl`). This is structurally justified: the wizard is a full-screen overlay and the shadow establishes "this card floats above a dimmed background." No other surface in the application uses a shadow.

### Named Rules

**The Flat-By-Default Rule.** No shadow appears on interactive or content elements. Hover and active states change background tint — they do not add elevation. If a new feature introduces a card component, interrogate whether the card metaphor is the correct affordance before adding any shadow.

**The Tonal Depth Rule.** Surface depth is expressed through the surface token scale: Surface Subtle (sidebar) → Surface White (main area) in light mode; Surface Darker (root) → Surface Dark (sidebar) in dark mode. Each step communicates hierarchy without visual noise.

## 5. Components

### Buttons

Lean and unambiguous. Buttons communicate their role through color and placement, not size or decoration. The system follows the Notion workspace geometric reference: sober rectangularity over pill shapes. Notion uses 8px for buttons and 12px for card containers; this system runs slightly rounder (12px for buttons, 16px for message bubbles) because the chat interface is warmer than a productivity dashboard — but the principle holds. Corners curve for warmth; they never pill for friendliness.

- **Shape:** Generously rounded (12px / rounded-xl) for standard buttons; compact inline actions use 6px (rounded-md)
- **Primary:** Ink Blue fill, white text, 12px/16px padding. Hover: Ink Blue Deep, no transition animation required. Disabled: 50% opacity on the element.
- **Danger / Abort:** Danger Red fill, white text, identical shape and padding. Appears only when a streaming response is active, replacing the send button. Never a permanent fixture on a surface.
- **Ghost / Outline:** Transparent fill, primary text color, 1px solid border (Border Subtle in light / Border Dark in dark). Hover: Bubble Light / Bubble Dark background tint. Used for secondary actions (Cancel, Personas toggle).
- **Compact Inline:** text-xs, rounded-md, px-2 py-1. Used for contextual actions within panels (Edit, Del, + New persona). These share the same color logic but at reduced scale.

### Inputs / Fields

- **Style:** 1px solid stroke (Border Subtle light / Border Dark dark), Surface White / Surface Dark background, 12px radius (rounded-xl)
- **Focus:** 2px Ink Blue (#3b82f6) ring, offset 0. No background change, no inset shadow. The ring is the only focus signal.
- **Textarea auto-expand:** Rows expand from 1 to a max-height of 160px (max-h-40). Growth is clamped; the input does not push layout.
- **Disabled:** 50% opacity on the element. No distinct visual state beyond opacity reduction.

### Navigation (Sidebar)

- 256px (w-64) fixed width, full viewport height
- Background: Surface Subtle (light) / Surface Dark (dark); 1px right border separator
- Header row: app name in Title weight + compact primary "New" button, separated by 1px bottom border
- Conversation item: full-width button, text-left, Title (font-medium) on first line, Label row below (backend + date in Text Muted). Rounded-lg corners. Active: Bubble Light / dark: gray-700 fill. Hover: Bubble Light / Bubble Dark.
- No icons. No avatars. Title text is the only identity signal for each conversation.

### Persona Panel

- 288px (w-72) fixed width, toggled via toolbar button; appears as an inline column to the right of chat
- Same border and background treatment as sidebar
- List items: rounded-lg, p-2. Active: Ink Blue Ghost (light) / blue-900 (dark). No icons.
- Inline edit form: appears below the list within the same panel column. Bordered container (rounded-lg, Border Light / Border Dark), not a modal. This is the deliberate pattern: prefer inline over modal.

### Message Bubbles (Signature Component)

The visual heart of the application. All other components exist to support this surface.

- **User message:** Right-aligned, max-width 80%, Ink Blue (#2563eb) fill, white text, 16px radius (rounded-2xl), px-4 py-2.
- **Assistant message:** Left-aligned, same shape, Bubble Light / Bubble Dark fill, Text Primary / Text Primary Inv. Rendered via react-markdown with `prose prose-sm dark:prose-invert` — do not override prose styles.
- **Metadata row:** Backend name and timestamp in Label size, Text Muted color, 50% opacity. Always present directly below message content.

### Wizard Progress Bar

- 3 equal-width segments, pill shape (rounded-full), 4px height, no gap between segments
- Filled: Ink Blue. Unfilled: Border Light / Border Dark.
- Used only in the setup wizard context. Not a reusable progress indicator for general use.

## 6. Do's and Don'ts

### Do

- **Do** use Ink Blue exclusively for interactive affordances that require user action (buttons, progress, active selections). One chromatic voice; use it with discipline.
- **Do** express depth through tonal surface steps: Surface Subtle beneath sidebar, Surface White for main area in light mode; Surface Darker for root, Surface Dark for sidebar in dark mode.
- **Do** render all assistant content through react-markdown's prose system. Do not write custom typography rules for AI-generated output.
- **Do** use rounded-2xl (16px) for message bubbles and the wizard card. Use rounded-xl (12px) for input fields and standard action buttons.
- **Do** keep all text at 14px (body) or 12px (label). Use weight — not size — when content needs emphasis.
- **Do** distinguish destructive actions (stop, delete) with Danger Red text or fill, never Ink Blue.
- **Do** place panel inline forms (persona edit) inline below the list rather than in modals.
- **Do** support full dark mode on every new surface added to the application.
- **Do** pair every color-coded state with a non-color signal (label, icon, or position). Color is never the sole indicator of meaning.
- **Do** restrict Text Muted (`#9ca3af`) to 12px label-size metadata in light mode. Never use it for text that carries primary information — it fails WCAG AA contrast against white.
- **Do** use only Regular (400) and Semibold (600) font weights. Lighter weights reduce legibility at small sizes, especially in variable ambient light.

### Don't

- **Don't** use gradient text (`background-clip: text` with a gradient fill). Prohibited without exception.
- **Don't** use glassmorphism or backdrop-filter blur decoratively. No surface currently uses it; any new proposal must justify structural necessity.
- **Don't** use ChatGPT or Claude.ai web visual language: gradient hero banners, glowing orbs, animated pulsing "AI thinking" spinners as primary UI states.
- **Don't** import Notion AI or Copilot-in-Word conventions: feature sidebars, template card grids, "AI magic" iconography, or onboarding tooltips on every surface.
- **Don't** build generic SaaS dashboard patterns: hero metric cards, grids of identical feature tiles, colorful sidebar icon navigation.
- **Don't** add shadows to hover states, active states, or any element that isn't functioning as a modal overlay. The only permitted shadow is `shadow-xl` on the wizard card.
- **Don't** use `border-left` or `border-right` wider than 1px as a colored accent stripe on list items, message bubbles, or content containers.
- **Don't** add a third chromatic color to the system without retiring one of the two existing accent roles.
- **Don't** load an external web font for the application shell. The system-ui stack is the deliberate choice.
- **Don't** use a font size other than 14px or 12px within the application shell. If something needs to stand out, increase weight or add spacing.
- **Don't** apply `opacity: 0.5` to already-muted text — stacking opacity on Text Muted compounds the contrast failure and produces unreadable metadata in light mode.
- **Don't** use light font weights (Ultralight, Thin, Light). Apple HIG explicitly prohibits these for interface text due to legibility failures at small sizes and in variable lighting.
