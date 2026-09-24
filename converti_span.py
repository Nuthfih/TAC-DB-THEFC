import os
import re

# CARTELLA DOVE CI SONO I FILE HTML:
FOLDER = r"path"

# Varianti ELEMENT con gli spazi come appaiono negli HTML
ELEMENTS = {
    "All", "Dark", "Fire", "Wind", "Light", "Thunder", "Water",
    "轟雷", "宵闇", "翠風", "烈火", "暁光", "蒼水"
}

# Varianti ORIGIN con gli spazi
ORIGINS = {
    "Desert Zone", "Envylia", "Gluttony Foss", "Greed Dike", "Lost Blue",
    "Lustburg", "Northern Pride", "Other", "Saga Region",
    "Slothstein", "Wadatsumi", "Wratharis"
}

SPAN_REGEX = re.compile(
    r'<span\s+data-tippy-content="([^"]+)"\s+class="([^"]+)"></span>'
)

def to_png(name):
    return name.replace(" ", "")

def convert_span(name):
    if name in ELEMENTS:
        return f"""
<span 
  data-tippy-content="{name}"
  style="
    display: inline-block;
    width: 26px;
    height: 26px;
    background-image: url('../../elements/{to_png(name)}.png');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  "
></span>"""

    if name in ORIGINS:
        return f"""
<span 
  data-tippy-content="{name}"
  style="
    display: inline-block;
    width: 24px;
    height: 24px;
    background-image: url('../../origins/{to_png(name)}.png');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  "
></span>"""

    return None


def process_file(path):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    def replace(match):
        name = match.group(1)
        new_block = convert_span(name)
        return new_block if new_block else match.group(0)

    new_html = SPAN_REGEX.sub(replace, html)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_html)

    print(f"✔ Aggiornato: {path}")


for file in os.listdir(FOLDER):
    if file.endswith(".html"):
        process_file(os.path.join(FOLDER, file))
