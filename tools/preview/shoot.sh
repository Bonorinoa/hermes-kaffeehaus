#!/bin/zsh
# Screenshot one scene at six hours (no Hermes needed). Needs Google Chrome.
# usage: tools/preview/shoot.sh <scene-folder>     e.g. tools/preview/shoot.sh _template  -> tools/preview/<scene>.png
cd "${0:A:h}"
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --user-data-dir="${TMPDIR:-/tmp}/scenes-preview-chrome" --window-size=2070,920 --virtual-time-budget=3000 \
  --screenshot="$PWD/${1:-_template}.png" "file://$PWD/scene.html?scene=${1:-_template}" 2>/dev/null
echo "tools/preview/${1:-_template}.png"
