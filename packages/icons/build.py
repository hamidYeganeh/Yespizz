"""Build the Duoline WOFF2 from an SVG directory (fonttools, brotli, skia-pathops)."""
import json
import math
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import pathops
from fontTools.colorLib.builder import buildCOLR, buildCPAL
from fontTools.ttLib.tables.otTables import PaintFormat
from fontTools.fontBuilder import FontBuilder
from fontTools.misc.transform import Identity
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import SVGPath

root = Path(__file__).parent
glyphs = {".notdef": TTGlyphPen(None).glyph()}
codes, layers, names = {}, {}, {}
palette = [(1, 1, 1, 1), (1, 1, 1, .2)]

for index, file in enumerate(sorted(Path(sys.argv[1]).glob("*.svg"))):
    name = file.stem
    code = 0xE000 + index
    names[name] = code
    codes[code] = name
    layers[name] = []
    fallback = TTGlyphPen(None)
    for element in ET.parse(file).getroot().iter():
        paint = element.get("stroke") or element.get("fill")
        if paint not in ("black", "#926247"):
            continue
        matrix = Identity
        rotation = element.attrib.pop("transform", None)
        if rotation:
            angle, x, y = map(float, rotation.removeprefix("rotate(").removesuffix(")").split())
            matrix = matrix.translate(x, y).rotate(math.radians(angle)).translate(-x, -y)
        path = pathops.Path()
        SVGPath.fromstring(ET.tostring(element)).draw(TransformPen(path.getPen(), matrix))
        if element.get("stroke"):
            path.stroke(float(element.get("stroke-width")), pathops.LineCap.BUTT_CAP,
                        pathops.LineJoin.ROUND_JOIN, 4)
        path.convertConicsToQuads(.01)
        pen = TTGlyphPen(None)
        for target in (pen, fallback):
            path.draw(TransformPen(Cu2QuPen(target, 1, reverse_direction=True),
                                   (40, 0, 0, -40, 0, 840)))
        layer = f"{name}.{len(layers[name])}"
        glyphs[layer] = pen.glyph()
        color = 0 if paint == "#926247" else 0xFFFF
        if element.get("fill-opacity") == "0.2":
            color = 1
        layers[name].append((layer, color))
    glyphs[name] = fallback.glyph()

font = FontBuilder(960, isTTF=True)
font.setupGlyphOrder(list(glyphs))
font.setupCharacterMap(codes)
font.setupGlyf(glyphs)
font.setupHorizontalMetrics({name: (960, getattr(glyph, "xMin", 0)) for name, glyph in glyphs.items()})
font.setupHorizontalHeader(ascent=840, descent=-120)
font.setupNameTable({"familyName": "Freud Duoline", "styleName": "Regular"})
font.setupOS2(sTypoAscender=840, sTypoDescender=-120, usWinAscent=840, usWinDescent=120)
font.setupPost()
# Paint every layer with the surrounding CSS color. Keep the Duoline contrast
# with opacity, including on accent buttons and destructive actions.
def themed_layer(glyph, color):
    return {"Format": PaintFormat.PaintGlyph, "Glyph": glyph,
            "Paint": {"Format": PaintFormat.PaintSolid, "PaletteIndex": 0xFFFF,
                      "Alpha": {0: 0.72, 1: 0.2}.get(color, 1.0)}}

def themed_layers(layers):
    return {name: {"Format": PaintFormat.PaintColrLayers,
                   "Layers": [themed_layer(glyph, color) for glyph, color in entries]}
            for name, entries in layers.items() if entries}

font.font["COLR"] = buildCOLR(themed_layers(layers), version=1)
font.font["CPAL"] = buildCPAL([palette])
font.font.flavor = "woff2"
font.save(root / "freud-duoline.woff2")
(root / "glyphs.json").write_text(json.dumps(names, indent=2) + "\n")
