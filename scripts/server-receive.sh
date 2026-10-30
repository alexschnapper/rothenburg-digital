#!/bin/sh
# Nimmt auf dem Server einen fertigen Build entgegen (Issue #22).
#
# Die Git-Deploy-Hooks und die SSH-Jail erreichen kein Node (siehe
# docs/DEPLOYMENT.md). GitHub Actions baut deshalb selbst und schickt nur das
# Ergebnis. Dieses Skript läuft als erzwungenes Kommando eines SSH-Schlüssels:
# Der Schlüssel kann nur dieses Skript für genau ein App-Verzeichnis ausführen.
#
#   authorized_keys:
#   restrict,command="/bin/sh /deploy/receive.sh staging.rothenburg.digital" ssh-ed25519 ...
#
# Aktionen (aus SSH_ORIGINAL_COMMAND):
#   deploy    liest ein tar.gz von stdin, tauscht .next und node_modules, startet neu
#   rollback  stellt den Stand vor dem letzten Deploy wieder her
#
# Nur POSIX-sh und Werkzeuge, die in der Jail nachweislich vorhanden sind.
# Der Arbeitsbereich liegt außerhalb des Document Root, damit nginx dort nichts
# ausliefert. Er muss auf demselben Dateisystem wie die App liegen, sonst ist
# `mv` kein schneller Tausch mehr.

set -eu

ROOT=${DEPLOY_ROOT:-}
APP_NAME=${1:-}

case "$APP_NAME" in
  dev.rothenburg.digital | staging.rothenburg.digital | httpdocs) ;;
  *)
    echo "Unbekanntes App-Verzeichnis: $APP_NAME" >&2
    exit 64
    ;;
esac

APP=$ROOT/$APP_NAME
WORK=$ROOT/deploy/$APP_NAME
NEW=$WORK/new
OLD=$WORK/old

restart() {
  mkdir -p "$APP/tmp"
  touch "$APP/tmp/restart.txt"
}

deploy() {
  mkdir -p "$WORK"
  rm -rf "$NEW"
  mkdir -p "$NEW"

  # Erst vollständig empfangen und entpacken. Bricht das ab, bleibt die
  # laufende Version unberührt.
  cat >"$WORK/upload.tar.gz"
  tar -xzf "$WORK/upload.tar.gz" -C "$NEW" .next node_modules
  rm -f "$WORK/upload.tar.gz"

  if [ ! -f "$NEW/.next/BUILD_ID" ] || [ ! -d "$NEW/node_modules/next" ]; then
    echo "Archiv unvollständig, nichts getauscht." >&2
    exit 65
  fi

  rm -rf "$OLD"
  mkdir -p "$OLD"
  for dir in .next node_modules; do
    if [ -e "$APP/$dir" ]; then
      mv "$APP/$dir" "$OLD/$dir"
    fi
    mv "$NEW/$dir" "$APP/$dir"
  done
  rm -rf "$NEW"

  restart
  echo "Ausgerollt: $APP_NAME"
}

rollback() {
  if [ ! -f "$OLD/.next/BUILD_ID" ]; then
    echo "Kein vorheriger Stand vorhanden." >&2
    exit 66
  fi

  rm -rf "$NEW"
  mkdir -p "$NEW"
  for dir in .next node_modules; do
    mv "$APP/$dir" "$NEW/$dir"
    mv "$OLD/$dir" "$APP/$dir"
  done
  rm -rf "$OLD" "$NEW"

  restart
  echo "Zurückgerollt: $APP_NAME"
}

case "${SSH_ORIGINAL_COMMAND:-}" in
  deploy) deploy ;;
  rollback) rollback ;;
  *)
    echo "Erlaubt sind nur: deploy, rollback" >&2
    exit 64
    ;;
esac
