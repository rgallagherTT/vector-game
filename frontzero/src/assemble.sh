#!/bin/sh
# Builds ../index.html from the parts: the head (HTML, CSS, config, manifest) first, then every module in order.
D=$(dirname "$0")
OUT=${1:-$D/../index.html}
cat "$D"/parts/00-head.html "$D"/parts/[0-9][0-9]*.js > "$OUT"
printf '\n</script>\n</body>\n</html>\n' >> "$OUT"
echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
