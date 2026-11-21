#!/usr/bin/env bash
# Modified 2026 by Treslibre Project (Treslibre).
set -euo pipefail

TEMPLATE=manifest-template.yml

# Parameters: <app-id> <flavor> <app-name>
function generate {
    local app_id=$1
    local flavor=$2
    local app_name=$3
    sed "s/{{app-id}}/$app_id/g" $TEMPLATE \
        | sed "s/{{flavor}}/$flavor/g" \
        | sed "s/{{app-name}}/$app_name/g" \
        | sed "s/{{runtime-version}}/${RUNTIME_VERSION:?}/g" \
        > "$app_id.yml"
}

# Work onprem
generate 'org.treslibre.app.desktop' 'work-onprem' 'Treslibre'
