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
#   deploy    liest ein tar.gz von stdin, tauscht .next, node_modules und public,
#             startet neu
#   rollback  stellt den Stand vor dem letzten Deploy wieder her
#
# `public` kommt seit #123 mit dem Build. Next.js liest beim Start ein, welche
# Dateien dort liegen; kamen sie erst danach über den Plesk-Git-Checkout,
# lieferte die App sie bis zum nächsten Neustart als 404 aus. Archive ohne
# `public` (ältere Workflows auf anderen Branches) werden weiter angenommen,
# dann bleibt `public` unberührt.
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
  # Das Archiv baut ci.yml und enthält nur .next, node_modules und public.
  tar -xzf "$WORK/upload.tar.gz" -C "$NEW"
  rm -f "$WORK/upload.tar.gz"

  if [ ! -f "$NEW/.next/BUILD_ID" ] || [ ! -d "$NEW/node_modules/next" ]; then
    echo "Archiv unvollständig, nichts getauscht." >&2
    exit 65
  fi
  if [ -d "$NEW/public" ] && [ ! -f "$NEW/public/teaser.html" ]; then
    echo "Archiv unvollständig (public ohne teaser.html), nichts getauscht." >&2
    exit 65
  fi
  if [ ! -d "$NEW/public" ]; then
    echo "Archiv ohne public, public bleibt unverändert." >&2
  fi

  # Alles tauschen, bevor neu gestartet wird: Die App sieht beim Start schon
  # den neuen Stand von public.
  rm -rf "$OLD"
  mkdir -p "$OLD"
  for dir in .next node_modules public; do
    [ -e "$NEW/$dir" ] || continue
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
  # Nur zurück, was der letzte Deploy getauscht hat (public fehlt bei Archiven
  # ohne public).
  for dir in .next node_modules public; do
    [ -e "$OLD/$dir" ] || continue
    if [ -e "$APP/$dir" ]; then
      mv "$APP/$dir" "$NEW/$dir"
    fi
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
