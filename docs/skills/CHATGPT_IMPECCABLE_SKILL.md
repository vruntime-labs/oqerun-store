# ChatGPT Impeccable — Oqerun Store adaptation

## Standard
Treat UI quality as a functional requirement. Do not settle for merely compiling or looking modern. The interface must communicate clearly, behave consistently, and remain accessible.

## Before implementation
- Inspect existing components, styles, breakpoints, assets, and interaction logic.
- Identify the three highest-impact issues.
- Preserve existing working behavior and established project patterns.
- Define a small set of design tokens before adding isolated style values.

## Visual system
- Establish semantic color tokens for surfaces, text, borders, focus, success, warning, and error.
- Use a restrained type scale and consistent font weights.
- Apply a spacing scale and align content to a deliberate grid.
- Use border radius purposefully; controls should not default to pill shapes.
- Keep shadows, gradients, blur, and decorative effects restrained.
- Maintain contrast in both supported themes.
- Use consistent icon sources and meaningful labels. Do not use emoji as interface icons.

## Interaction and accessibility
- Use semantic buttons, links, headings, labels, and form controls.
- Ensure keyboard navigation, visible focus, logical tab order, and accessible names.
- Do not communicate status through color alone.
- Provide clear validation, error, loading, empty, success, and disabled states.
- Respect reduced-motion preferences.
- Avoid animation that delays interaction or causes unnecessary movement.
- Make touch targets practical and layouts responsive.

## Implementation quality
- Reuse existing components and tokens instead of duplicating styles.
- Avoid brittle selectors, arbitrary one-off values, unnecessary dependencies, and broad rewrites.
- Keep HTML structure and CSS responsibilities understandable.
- Check for console errors, broken links, overflow, and layout regressions.
- Test representative desktop and mobile widths and keyboard flows.
- Report what was tested and what remains unverified.

## Oqerun Store visual exclusions
No purple gradients, pill-shaped buttons, fake reviews or metrics, vague copy, emoji icons, em dashes, cursor animations, AI-slop imagery or copy, fake customer counters, or “Made with AI” tags. Do not add a custom-domain launch blocker.
