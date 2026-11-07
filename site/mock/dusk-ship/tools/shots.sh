#!/bin/zsh
# tools/shots.sh <outdir> [overlay=1] — the four review shots (wide, raft x dark, light x 1440, 390)
out=${1:-/tmp/shots}; ov=${2:-1}; mkdir -p $out
for cam in wide raft; do for theme in dark light; do for w in 1440 390; do
  node ${0:h}/shot.mjs $cam $theme $w $out/$cam-$theme-$w.png "reduced=1&overlay=$ov&ui=0" | cut -c1-70
done; done; done
