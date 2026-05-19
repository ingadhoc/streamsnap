#!/bin/bash
# Install icon at standard hicolor sizes so Ubuntu/GNOME finds it
SRC="/usr/share/icons/hicolor/512x512/apps/streamsnap.png"

for SIZE in 256 128 48; do
  DIR="/usr/share/icons/hicolor/$SIZE"x"$SIZE/apps"
  mkdir -p "$DIR"
  if command -v convert >/dev/null 2>&1; then
    convert "$SRC" -resize "$SIZE"x"$SIZE" "$DIR/streamsnap.png" 2>/dev/null || cp "$SRC" "$DIR/streamsnap.png"
  else
    cp "$SRC" "$DIR/streamsnap.png"
  fi
done

gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
update-desktop-database /usr/share/applications 2>/dev/null || true

# Set setuid bit on chrome-sandbox so Electron sandbox works without --no-sandbox
chmod 4755 /opt/StreamSnap/chrome-sandbox 2>/dev/null || true
