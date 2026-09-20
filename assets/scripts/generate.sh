#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
blender_bin="${BLENDER_BIN:-$HOME/Library/Application Support/Steam/steamapps/common/Blender/Blender.app/Contents/MacOS/Blender}"
"$blender_bin" --background --factory-startup --python assets/scripts/generate_sample.py
