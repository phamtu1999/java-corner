#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
BUILD_DIR=$(mktemp -d)
trap 'rm -rf "$BUILD_DIR"' EXIT
javac --release 8 -Xlint:-options -cp web/emulator/freej2me-web.jar -d "$BUILD_DIR" web/emulator/network-src/javax/microedition/io/*.java web/emulator/network-src/org/recompile/freej2me/*.java
javac -cp "$BUILD_DIR:web/emulator/freej2me-web.jar" -d "$BUILD_DIR" scripts/test-emulator-network.java
java -cp "$BUILD_DIR:web/emulator/freej2me-web.jar" TestEmulatorNetwork
javac -cp "$BUILD_DIR" -d "$BUILD_DIR" scripts/test-game-save.java
(cd "$BUILD_DIR" && java -cp "$BUILD_DIR" TestGameSave)
cp web/emulator/freej2me-web.jar "$BUILD_DIR/freej2me-web-network.jar"
jar uf "$BUILD_DIR/freej2me-web-network.jar" -C "$BUILD_DIR" javax -C "$BUILD_DIR" org
cp "$BUILD_DIR/freej2me-web-network.jar" web/emulator/freej2me-web-relay-v3.jar
