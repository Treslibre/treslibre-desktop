#!/usr/bin/env bash
# Modified 2026 by Treslibre Project (Treslibre).
# Phase 5 (§5.1): Automated CI Audit Gate for treslibre-desktop
set -euo pipefail

echo "=== [1/2] Auditing codebase for upstream Threema domains, legal entity addresses, and Swiss UID ==="
MAIN_PATTERNS='\bthreema\.(ch|com|id|de|work)\b|Churerstrasse|Pfäffikon|CHE-487\.082\.806'

if grep -RInE "$MAIN_PATTERNS" . \
    --exclude-dir=.git \
    --exclude-dir=node_modules \
    --exclude-dir=build \
    --exclude-dir=dist \
    --exclude-dir=target \
    --exclude-dir=.turbo \
    --exclude-dir=.licenses \
    --exclude="LICENSE*" \
    --exclude="COPYING*" \
    --exclude="NOTICE*" \
    --exclude="THIRD_PARTY*" \
    --exclude="MANUAL_ASSETS.md" \
    --exclude="audit-debrand.sh" \
    --exclude="pnpm-lock.yaml" \
    --exclude="Cargo.lock"; then
    echo "ERROR: Prohibited upstream domain or legal imprint string found!"
    exit 1
fi
echo "OK: Zero prohibited upstream domains or legal entity strings found."

echo "=== [2/2] Auditing user-facing localization, manifest, and desktop files for lingering Threema product strings ==="
# Exclude AGPL attribution strings ("fork of Threema", "Threema AG", "Threema GmbH") and internal icon font filename references
UI_FILES=(
    "apps/desktop/src/translations/en/translation.json"
    "apps/desktop/src/translations/de/translation.json"
    "apps/desktop/src/public/treslibre.webmanifest"
    "apps/desktop/packaging/metadata/org.treslibre.app.desktop.desktop"
    "apps/desktop/packaging/metadata/org.treslibre.app.desktop.metainfo.xml"
    "apps/desktop/packaging/msix/AppxManifest.xml"
    "apps/conferencing/index.html"
)

UI_FAIL=0
for f in "${UI_FILES[@]}"; do
    if [ -f "$f" ]; then
        MATCHES=$(grep -InE 'Threema' "$f" | grep -vE 'fork of Threema|endorsed by Threema|Threema AG|Threema GmbH|ThreemaIcons' || true)
        if [ -n "$MATCHES" ]; then
            echo "Forbidden UI string in $f:"
            echo "$MATCHES"
            UI_FAIL=1
        fi
    fi
done

if [ "$UI_FAIL" -ne 0 ]; then
    echo "ERROR: Lingering Threema product branding found in user-facing UI/manifest files!"
    exit 1
fi
echo "OK: Zero lingering Threema product strings in user-facing UI/manifest files."
echo "=== Audit Passed (exit 0) ==="
