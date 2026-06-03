#!/bin/bash
# deploy.sh — Build + deploy loveintea-studio to standalone production
set -e

PROJECT="/Volumes/SSD/projects/loveintea-studio"
STANDALONE="$PROJECT/.next/standalone"

echo "=== Building ==="
cd "$PROJECT"
npx next build 2>&1 | tee /tmp/loveintea-build.log

echo "=== Copying public + static assets ==="
cp -r "$PROJECT/public/." "$STANDALONE/public/"
cp -r "$PROJECT/.next/static" "$STANDALONE/.next/static"

echo "=== Restarting service ==="
lsof -ti:3202 | xargs kill -9 2>/dev/null || true
sleep 1
launchctl kickstart -k gui/$(id -u)/com.loveintea.studio 2>/dev/null || (launchctl unload ~/Library/LaunchAgents/com.loveintea.studio.plist; sleep 1; launchctl load ~/Library/LaunchAgents/com.loveintea.studio.plist)
sleep 4

lsof -ti:3202 && echo "=== Deploy done — server UP ===" || echo "=== ERROR: server not started ==="
