#!/bin/zsh
# Screenshot the real bundle on a stand-in chat page (not Hermes). Needs Google Chrome.
# usage: tools/fixture/shoot.sh <name> "<query>"   e.g. shoot.sh classic "seat=classic&open=1"
# query: seat=window|focus|classic  hour=0..23.75  open=1 (card open)  busy=1 (Hermes working)  wait=ms
cd "${0:A:h}" && mkdir -p shots && cp ../../desktop/plugin.js plugin.js
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
  --user-data-dir="${TMPDIR:-/tmp}/kaffeehaus-fixture-chrome" --window-size=1440,900 --virtual-time-budget=6000 \
  --screenshot="$PWD/shots/$1.png" "file://$PWD/fixture.html?$2" 2>/dev/null
echo "shots/$1.png"
