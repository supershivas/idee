#!/usr/bin/env bash
set -euo pipefail
BASE="https://raw.githubusercontent.com/supershivas/design-system/main"

curl -fsSL "$BASE/design-tokens.json" -o design-tokens.json
echo "design-tokens.json mis à jour depuis supershivas/design-system"

curl -fsSL "$BASE/mobile.css" -o app/mobile.css
echo "mobile.css mis à jour depuis supershivas/design-system"
