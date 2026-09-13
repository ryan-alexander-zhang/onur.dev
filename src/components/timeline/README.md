# shadcn-timeline

Source: https://github.com/timDeHof/shadcn-timeline

Pinned upstream commit: `23a910569ca1f44eafd4d069f4ec523d9e2934ab`.
Imported `src/components/timeline/timeline.tsx` directly, stripping TypeScript with esbuild to match this JavaScript project. The MIT license is retained in `LICENSE`.

Local integration changes:

- Use the existing react-icons Lucide icons and site color utilities.
- Accept children in TimelineItem for full Journal Markdown sections.
- Use a responsive date / marker / content grid and a connector that follows variable content height.
- Format Journal dates in UTC so a date-only entry does not move to the previous day in western time zones.
- Apply repository formatting and JavaScript lint conventions.

Journey uses the upstream Timeline and TimelineItem primitives directly. TimelineLayout is not imported: its wrapper reverses input order and wraps list items in divs; Journey already groups and sorts entries explicitly.
