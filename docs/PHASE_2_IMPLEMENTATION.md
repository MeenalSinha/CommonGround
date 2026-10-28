# Phase 2 implementation: mobile UI foundation

**Status: implemented but UNVERIFIED.** The code was written without being able to install dependencies
or run Jest, ESLint, Prettier, `tsc` or Expo. Expect to fix small type, lint or formatting issues on the
first `npm run check`. See `PHASE_2_PRE_UPGRADE_AUDIT.md` for the audit and go/no-go.

## Design direction
Cozy, game-like and friendly: warm cream backgrounds, coral primary, sky/yellow/mint/lavender accents,
Fredoka headings with Nunito body (OFL, unchanged). Chunky lower edge on buttons and tappable cards gives
a game-button feel without heavy shadows. One subtle motion: the decorative faces bob; it stops under
reduced motion.

## Design system
- `theme/tokens.ts`: coral darkened for contrast; added `focus` color, `focusBorderWidth`, `buttonDepth`,
  `stateGlyph`, `logoMarkCompact`, `motion.bob*`; removed unused `interaction.disabledOpacity`.
- No new theme files; no duplicated definitions.

## Components
- New `StateMessage`: one presentation for loading / empty / unavailable / error / success. Heading and glyph
  carry meaning, not color alone; errors use `accessibilityRole="alert"`.
- `Card`: optional `onPress` turns it into a real button; without it the card is inert.
- `Button`: chunky depth edge; unchanged API.
- `Screen`: `edges` prop so screens under a navigation header do not double the top inset.
- `Logo` gained `compact`; `AvatarCluster` bobs unless reduced motion.
- New `StatusSummary`; shared label logic moved to `utils/status.ts` (`backendPill`, `qlooPill`,
  `searchAvailability`).
- `ConnectionPanel` and `EntitySearch` use `StateMessage`; search input has a visible focus state.

## Navigation
Expo Router `Stack` with three routes: `/` (home, no header), `/status` and `/search` (native header, back
button). Chosen because the two existing features (diagnostics, entity search) are real and deserve their own
screens, while no placeholder routes or tab bar were added. Status is owned by one `BackendStatusProvider` in
`_layout.tsx`, so navigating never refetches; it still loads on mount and on explicit refresh only.

## Home screen
Compact brand, hero card with the tagline, intro, and a real primary action (entity search), a "How it will
work" card labelled **Coming soon** (static copy, no group action), and a live status summary linking to
`/status`. No fake data: results and statuses come only from the backend.

## Integration status
`/status` keeps all seven required states by mapping real backend state (`not_configured`,
`pending_verification`, `ready`, `auth_failed`, `rate_limited`, `unavailable`) plus backend
online/offline/checking. Verified is shown only when the backend says `ready`. Refresh and Verify perform real
requests.

## Tests
`HomeScreen.test.tsx` (new), `StatusScreen.test.tsx` (existing connection tests, retargeted),
`SearchScreen.test.tsx` (existing search tests plus empty vs error vs loading, disabled reasons). Shared mocks
(safe-area, reduced motion) moved to `jest.setup.ts`. `expo-router` is mocked in the home test to assert
`push('/search')` and `push('/status')`. Not run.

## Known limitations
- Nothing was executed: no Jest, ESLint, Prettier, `tsc`, Expo start or export. Formatting was hand-matched to
  `.prettierrc` and may need `npm run format`.
- No simulator or device inspection; layout, narrow-screen behavior and safe areas are unverified visually.
- The bobbing animation has no automated test (reduced-motion is covered only by the mocked static path).
- `apps/mobile/.git` nested repository left in place.
- Live Qloo verification still pending (no API key).

## Next-phase readiness
Ready, once checks pass: design system, navigation shell, status/search plumbing. Blocked: live Qloo
verification (key), device validation.
