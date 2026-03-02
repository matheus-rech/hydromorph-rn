#!/usr/bin/env bash
# ============================================================================
# fix_rn.sh — Patch HydroMorph React Native project in-place
# Run from inside the hydro_ci_rn folder
#
# Usage:
#   chmod +x fix_rn.sh
#   cd hydro_ci_rn
#   ../fix_rn.sh
# ============================================================================

set -euo pipefail

GREEN='\033[0;32m'
NC='\033[0m'
info() { echo -e "${GREEN}[✓]${NC} $1"; }

# Check we're in the right place
[ -f "app.json" ] || { echo "Run this from inside the hydro_ci_rn folder"; exit 1; }

# ── 1. Fix eas.json: add appVersionSource ──────────────────────────────────
if ! grep -q "appVersionSource" eas.json 2>/dev/null; then
  sed -i.bak 's/"version": ">= 12.0.0"/"version": ">= 12.0.0",\n    "appVersionSource": "remote"/' eas.json
  rm -f eas.json.bak
  info "eas.json: added appVersionSource"
else
  info "eas.json: appVersionSource already present"
fi

# ── 2. Generate placeholder icons ──────────────────────────────────────────
mkdir -p assets

python3 - << 'PYEOF'
from PIL import Image, ImageDraw, ImageFont
import os

ASSETS = "assets"

def make_icon(path, size, text="HM", bg="#0d1117", fg="#58a6ff"):
    img = Image.new("RGBA", (size, size), bg)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/Library/Fonts/Arial Bold.ttf", size // 3)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size // 3)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size // 3)
            except:
                font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), text, fill=fg, font=font)
    img.save(path)
    print(f"  Created {path} ({size}x{size})")

if not os.path.exists(f"{ASSETS}/icon.png"):
    make_icon(f"{ASSETS}/icon.png", 1024)
if not os.path.exists(f"{ASSETS}/favicon.png"):
    make_icon(f"{ASSETS}/favicon.png", 48)
if not os.path.exists(f"{ASSETS}/adaptive-icon.png"):
    make_icon(f"{ASSETS}/adaptive-icon.png", 1024)
if not os.path.exists(f"{ASSETS}/splash.png"):
    splash = Image.new("RGBA", (1284, 2778), "#0d1117")
    draw = ImageDraw.Draw(splash)
    try:
        font = ImageFont.truetype("/Library/Fonts/Arial Bold.ttf", 120)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 120)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
            except:
                font = ImageFont.load_default()
    text = "HydroMorph"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((1284-tw)//2, (2778-th)//2 - bbox[1]), text, fill="#58a6ff", font=font)
    splash.save(f"{ASSETS}/splash.png")
    print(f"  Created splash.png (1284x2778)")
PYEOF
info "Icon assets generated"

# ── 3. Fix app.json: add splash image + adaptive icon foreground ───────────
python3 - << 'PYEOF'
import json

with open("app.json", "r") as f:
    config = json.load(f)

expo = config["expo"]

# Add splash image
if "image" not in expo.get("splash", {}):
    expo["splash"]["image"] = "./assets/splash.png"

# Add adaptive icon foreground
if "foregroundImage" not in expo.get("android", {}).get("adaptiveIcon", {}):
    expo["android"]["adaptiveIcon"]["foregroundImage"] = "./assets/adaptive-icon.png"

with open("app.json", "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")

print("  app.json updated")
PYEOF
info "app.json patched"

# ── 4. Install dependencies ────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
npm install
info "npm install complete"

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  All fixed. Now run:"
echo "  npx eas-cli@latest build --platform all"
echo "═══════════════════════════════════════════════════"
