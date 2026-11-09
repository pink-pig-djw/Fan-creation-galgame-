#!/bin/bash
# usage: runp.sh [-j N] BATCH [BATCH...]  — builds prompts, runs batches with at most N codex processes at once (refs from batches.js)
cd /c/Users/13857/Desktop/galgame/lycoris
J=5; if [ "$1" = "-j" ]; then J=$2; shift 2; fi
node tools/build.js "$@"
one() {
  b="$1"
  refs=$(node -e "const B=require('./tools/prompts/batches.js');console.log(((B['$b']||{}).refs||[]).map(r=>'C:/Users/13857/Desktop/galgame/lycoris/'+r).join(' '))")
  bash tools/gen.sh "$b" $refs
}
export -f one
printf '%s\n' "$@" | xargs -P "$J" -I{} bash -c 'one {}'
echo "ALL DONE: $*"
grep -lE "usage.limit|Too Many Requests|rate.limit" $(printf "tools/out/%s.log " "$@") 2>/dev/null && echo "!! QUOTA HIT in the logs above" || true
