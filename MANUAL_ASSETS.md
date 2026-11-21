# Manual Visual Assets Replacement List (`treslibre-desktop`)

All upstream Threema visual assets and branded glyphs below have been replaced with clean
**Treslibre** geometric shield + `"TL"` monogram + 3-bar security placeholder artwork. Replace these
placeholders with final production artwork before public distribution.

## Root & Web Branding

- `logo_dark.svg` — Light-on-dark wordmark (`807.85 x 185.65` viewBox)
- `logo_light.svg` — Dark-on-light wordmark (`807.85 x 185.65` viewBox)
- `apps/desktop/src/public/res/splash.svg` — Splash screen monochrome wordmark (`991.1 x 181.75`
  viewBox)
- `packages/branding/src/assets/logos/nav-panel-logo-private-{light,dark}.svg`
- `packages/branding/src/assets/logos/nav-panel-logo-onprem-{light,dark}.svg`
- `packages/branding/src/assets/logos/nav-panel-logo-work-{light,dark}.svg`
- `packages/branding/src/assets/logos/nav-panel-logo-green-{light,dark}.svg`
- `packages/branding/src/assets/logos/nav-panel-logo-blue-{light,dark}.svg`

## Application Icons & Packaging Artwork

- `apps/desktop/src/public/res/icons/icon-monochrome-square.svg` — Monochrome mask icon
  (`1024x1024`)
- `apps/desktop/packaging/assets/icons/base/icon-monochrome-square.svg` — Source monochrome mask
  icon (`1024x1024`)
- `apps/desktop/packaging/assets/icons/base/icon-{consumer-live,consumer-sandbox,work-live,work-onprem,work-sandbox}.svg`
  & `-1024{,-macos,-square}.png`
- `apps/desktop/packaging/assets/icons/flatpak/{consumer-live,consumer-sandbox,work-live,work-onprem,work-sandbox}.{svg,png}`
  (`512x512`)
- `apps/desktop/packaging/assets/icons/win/{consumer-live,consumer-sandbox,work-live,work-onprem,work-sandbox}.ico`
  (multi-size `16`–`256`)
- `apps/desktop/packaging/assets/icons/mac/{consumer-live,consumer-sandbox,work-live,work-onprem,work-sandbox}.icns`
- `apps/desktop/packaging/assets/installers/{consumer,onprem,work}{,@2x}.png` (`658x498` /
  `1316x996` macOS DMG backgrounds)
- `apps/desktop/src/public/res/icons/{consumer-live,consumer-sandbox,work-live,work-onprem,work-sandbox}/icon-{64,128,180,192,256,512}.png`
- `apps/desktop/src/public/res/icons/msix/{consumer-live,consumer-sandbox,work-live,work-onprem,work-sandbox}/{StoreLogo,Square150x150Logo,Square44x44Logo*}.png`

## Contact Verification & Badge Iconography

- `apps/desktop/src/app/ui/svelte-components/threema/VerificationDots/VerificationDots.svelte` —
  Replaced 3-dot circular motif with a 3-bar segmented shield motif (preserving 3-tier verification
  CSS states).
- `apps/desktop/src/public/res/fonts/threema-icons/ThreemaIcons-{Filled,Outlined}.woff2` &
  `packages/branding/src/assets/fonts/threema-icons/ThreemaIcons-{Filled,Outlined}.woff2` — Replaced
  proprietary lock-chat-bubble glyphs (`uniE901`, `uniE904`, `uniE909`, `uniE90E`) with generic
  security shield badge glyphs while retaining non-branded UI ligature glyphs.
