#!/usr/bin/env python3
"""
build_unit_api.py
-----------------
Estrae i dati dalle pagine unit/SLUG.html e crea file JSON
nella cartella api/ che il server servirà come /get-unit?slug=X

Uso:
    py build_unit_api.py <site_root> [--slug edgar]

Esempio:
    py build_unit_api.py "D:\alchemsitdb\way\finale\ACDBfixed"
    py build_unit_api.py "D:\alchemsitdb\way\finale\ACDBfixed" --slug edgar
"""

import argparse
import json
import re
import sys
from pathlib import Path

# Mappa stat name HTML → campi unitData (min, max)
STAT_MAP = {
    "HP":     ("hp",  "mhp"),
    "PATK":   ("atk", "matk"),
    "PDEF":   ("def", "mdef"),
    "MATK":   ("mag", "mmag"),
    "MDEF":   ("mnd", "mmnd"),
    "DEX":    ("dex", "mdex"),
    "AGI":    ("spd", "mspd"),
    "CRIT":   ("cri", "mcri"),
    "LUCK":   ("luk", "mluk"),
    "Jewels": ("mp",  "mmp"),
}

# Mappa element name → numero
ELEM_MAP = {
    "Fire": 1, "Water": 2, "Wind": 3, "Thunder": 4,
    "Light": 5, "Dark": 6, "All": 0,
    "烈火": 1, "蒼水": 2, "翠風": 3, "轟雷": 4, "暁光": 5, "宵闇": 6,
}

# Mappa origin name → birth number
BIRTH_MAP = {
    "Envylia": 1, "Wratharis": 2, "Slothstein": 3, "Lustburg": 4,
    "Gluttony Foss": 5, "Greed Dike": 6, "Saga Region": 7,
    "Wadatsumi": 8, "Desert Zone": 9, "Northern Pride": 10,
    "Lost Blue": 11, "Other": 100,
}

SEX_MAP = {"Male": 1, "Female": 2}



GEAR_STAT_MAP = {
    "HP": "hp", "PATK": "atk", "PDEF": "def", "MATK": "mag", "MDEF": "mnd",
    "DEX": "dex", "AGI": "spd", "CRIT": "cri", "LUCK": "luk", "Jewels": "mp",
    "Max Jewels": "mp", "Healing": "heal", "Initial Jewels": "mp_init",
    "PATK Power": "patk_power", "MATK Power": "matk_power",
    "Evasion Rate": "evasion", "Hit Rate": "hit_rate",
}

def parse_stats_string(stats_str):
    """Converte stringa stats (es 'HP +550 MDEF +30') in dict numerico."""
    result = {}
    # Pattern: "STAT NAME +N" o "STAT NAME -N"  
    for stat_name, key in GEAR_STAT_MAP.items():
        pattern = re.escape(stat_name) + r"\s*([+-])(\d+)"
        m = re.search(pattern, stats_str)
        if m:
            sign = -1 if m.group(1) == "-" else 1
            result[key] = sign * int(m.group(2))
    return result

def extract_recommended_gear(content):
    """Estrae gear consigliati con stat numeriche dalla sezione Related Gears."""
    gear_list = []
    section = re.search(
        r'Related Gear.*?<tbody>(.*?)</tbody>',
        content, re.DOTALL | re.IGNORECASE
    )
    if not section:
        return gear_list
    rows = re.findall(
        r'<img[^>]+src="[^"]+ArtiIcon/([^"./]+)\.png"[^>]*/>'
        r'.*?<a href="([^"]+)">([^<]+)</a>'
        r'.*?<td>[^<]+</td>'
        r'.*?<td>(.*?)</td>',
        section.group(1), re.DOTALL
    )
    for img_name, href, name, stats_html in rows:
        stats_str = re.sub(r'<[^>]+>', ' ', stats_html)
        stats_str = re.sub(r'\s+', ' ', stats_str).strip()
        numeric_stats = parse_stats_string(stats_str)
        gear_list.append({
            "name": name.strip(),
            "href": href.strip(),
            "img": img_name.upper(),
            "stats": stats_str,
            "numeric_stats": numeric_stats,
        })
    return gear_list

def extract_recommended_mementos(content):
    """Estrae mementos consigliati con numeric_stats dalla sezione Related Mementos."""
    memo_list = []
    section = re.search(
        r'Related Memento.*?<tbody>(.*?)</tbody>',
        content, re.DOTALL | re.IGNORECASE
    )
    if not section:
        return memo_list
    rows = re.findall(
        r'<img[^>]+src="[^"]+ConceptCardIcon/([^"./]+)\.png"[^>]*/>' 
        r'.*?<a href="([^"]+)">([^<]+)</a>'
        r'.*?<td>(.*?)</td>',
        section.group(1), re.DOTALL
    )
    for img_name, href, name, stats_html in rows:
        stats_str = re.sub(r'<[^>]+>', ' ', stats_html)
        stats_str = re.sub(r'\s+', ' ', stats_str).strip()
        numeric_stats = parse_stats_string(stats_str)
        memo_list.append({
            "name": name.strip(),
            "href": href.strip(),
            "img": img_name.upper(),
            "stats": stats_str,
            "numeric_stats": numeric_stats,
        })
    return memo_list


def extract_passives_for_jobs(content, job_inames):
    """Estrae le passive (solo Support, no Reaction) per ogni job."""
    passives_by_job = {}
    
    passive_blocks = list(re.finditer(
        r'Passive Abilities</div>\s*<div[^>]*>(.+?)(?=<div class="card-header|$)',
        content, re.DOTALL
    ))
    
    for i, job_iname in enumerate(job_inames):
        if i >= len(passive_blocks):
            break
        block = passive_blocks[i].group(1)
        passives = []
        
        # Usa un parser manuale per trovare le skill-table con tabelle annidate
        skill_blocks = []
        pos = 0
        while True:
            start = block.find('<table class="table skill-table">', pos)
            if start == -1:
                break
            depth = 0
            j = start
            table_end = -1
            while j < len(block):
                if block[j:j+7] == '<table ' or block[j:j+7] == '<table>':
                    depth += 1
                elif block[j:j+8] == '</table>':
                    depth -= 1
                    if depth == 0:
                        table_end = j + 8
                        break
                j += 1
            if table_end < 0:
                break
            # Includi anche i div collassabili che seguono (Target Buff Self, Self Buff)
            next_table_start = block.find('<table class="table skill-table">', table_end)
            if next_table_start < 0:
                next_table_start = len(block)
            # sb = contenuto dentro il table + div collassabili successivi
            sb_inner = block[start+len('<table class="table skill-table">'):table_end]
            sb_extra = block[table_end:next_table_start]
            skill_blocks.append(sb_inner + sb_extra)
            pos = table_end
        for sb in skill_blocks:
            # Controlla tipo — salta Reaction (ability-type-2)
            type_m = re.search(r'data-tippy-content="([^"]+)"\s+class="ability-type-icon', sb)
            if type_m and type_m.group(1).lower() == "reaction":
                continue
            
            name_m = re.search(r'<a href="([^"]+)">([^<]+)</a>', sb)
            if not name_m:
                continue
            desc_m = re.search(r'<tbody>.*?<tr>\s*<td>(.*?)</td>', sb, re.DOTALL)
            desc = ""
            if desc_m:
                desc = re.sub(r'<[^>]+>', '', desc_m.group(1)).strip()
            
            skill_type = type_m.group(1) if type_m else "Support"
            href = name_m.group(1).strip()
            skill_slug_m = re.search(r'skill/([^/]+)\.html', href)
            skill_slug = skill_slug_m.group(1) if skill_slug_m else ""

            # Estrai valori buff dalla skill table nella pagina unit
            # Cerca SOLO Self Buff (passiva permanente), ignora Target Buff (attivo) e Condition
            buff_stats = {}
            BUFF_STAT_MAP_P = {
                "HP":"hp","PATK":"atk","PDEF":"def","MATK":"mag","MDEF":"mnd",
                "DEX":"dex","AGI":"spd","CRIT":"cri","LUCK":"luk","Jewels":"mp",
                "PATK Power":"patk_power","MATK Power":"matk_power",
                "Evasion Rate":"evasion","Hit Rate":"hit_rate",
                "Healing Power":"heal_power","Critical Rate":"crit_rate",
                "Jewels Obtained":"mp_obtain","Initial Jewels":"mp_init",
                "Buff Duration":"buff_dur","MOVE":"move","JUMP":"jump",
                "Slash ATK Power":"slash_power","Pierce ATK Power":"pierce_power",
                "Missile ATK Power":"missile_power","Magic ATK Power":"magic_power",
                "Fire ATK Power":"fire_power","Water ATK Power":"water_power",
                "Wind ATK Power":"wind_power","Thunder ATK Power":"thunder_power",
                "Light ATK Power":"light_power","Dark ATK Power":"dark_power",
            }
            # Cerca caption blocks nel blocco della skill (sb)
            caption_blocks = re.findall(
                r'<caption>([^<]*)</caption>(.*?)</tbody>',
                sb, re.DOTALL
            )
            for cap, tbody in caption_blocks:
                cap = cap.strip()
                # Salta Target Buff (non-Self) e Condition
                # Accetta: Self Buff, Target Buff (Self)
                if "Condition" in cap: continue
                if "Target" in cap and "Self" not in cap: continue
                # Pattern Min/Max separati
                for stat_name, _, max_val in re.findall(
                    r'<th>([^<]+)</th>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]+)</td>', tbody
                ):
                    stat_name = stat_name.strip()
                    if stat_name in ("Type","Min","Max","Stats","Rate","Value"): continue
                    key = BUFF_STAT_MAP_P.get(stat_name)
                    if not key: continue
                    max_clean = re.sub(r'\s*\([^)]*\)', '', max_val).strip()
                    vm = re.match(r'([+-])(\d+)(%?)', max_clean)
                    if vm:
                        sign = -1 if vm.group(1) == '-' else 1
                        buff_stats[key] = {"val": sign * int(vm.group(2)), "pct": bool(vm.group(3))}
                # Pattern colspan="2"
                for stat_name, val in re.findall(
                    r'<th>([^<]+)</th>\s*<td[^>]*colspan[^>]*>([^<]+)</td>', tbody
                ):
                    stat_name = stat_name.strip()
                    if stat_name in ("Type","Min","Max","Stats","Rate","Value"): continue
                    key = BUFF_STAT_MAP_P.get(stat_name)
                    if not key: continue
                    val_clean = re.sub(r'\s*\([^)]*\)', '', val).strip()
                    vm = re.match(r'([+-])(\d+)(%?)', val_clean)
                    if vm:
                        sign = -1 if vm.group(1) == '-' else 1
                        buff_stats[key] = {"val": sign * int(vm.group(2)), "pct": bool(vm.group(3))}

            passives.append({
                "name": name_m.group(2).strip(),
                "href": href,
                "skill_slug": skill_slug,
                "desc": desc,
                "type": skill_type,
                "buff_stats": buff_stats,
            })
        
        passives_by_job[job_iname] = passives
    
    return passives_by_job


def extract_leader_master(content):
    """Estrae Leader Skill e Master Ability."""
    result = {}
    
    # Leader Skill
    ls = re.search(
        r'Leader Skill.*?<a href="([^"]+)">([^<]+)</a>.*?<td[^>]*>(.*?)</td>',
        content, re.DOTALL
    )
    if ls:
        desc = re.sub(r'<[^>]+>', '', ls.group(3)).strip()
        result["leader_skill"] = {
            "name": ls.group(2).strip(),
            "href": ls.group(1).strip(),
            "desc": desc,
        }
    
    # Master Ability
    ma = re.search(
        r'Master Ability.*?<a href="([^"]+)">([^<]+)</a>.*?<tr>\s*<td>(.*?)</td>',
        content, re.DOTALL
    )
    if ma:
        desc = re.sub(r'<[^>]+>', '', ma.group(3)).strip()
        result["master_ability"] = {
            "name": ma.group(2).strip(),
            "href": ma.group(1).strip(),
            "desc": desc,
        }
    
    return result


def extract_gates(content):
    """Estrae i bonus stat per ogni gate e level da tutte le tab gate."""
    gates = {}
    gate_names = ["envy", "sloth", "lust", "gluttony", "wrath", "greed", "pride"]
    
    STAT_MAP = {
        "HP": "hp", "PATK": "atk", "PDEF": "def",
        "MATK": "mag", "MDEF": "mnd", "DEX": "dex",
        "AGI": "spd", "CRIT": "cri", "LUCK": "luk",
        "Jewels": "mp", "Move": "jmov", "Jump": "jjmp",
    }
    
    for gate in gate_names:
        # Trova il blocco del gate
        section = re.search(
            rf'id="{gate}-gate"[^>]*>(.*?)(?=id="[a-z]+-gate"|$)',
            content, re.DOTALL
        )
        if not section:
            continue
        
        block = section.group(1)
        gate_data = {"levels": []}
        
        # Cerca la tabella Enhancement Stats con Level/HP/PATK...
        table = re.search(
            r'<caption>Stats</caption>.*?<thead>(.*?)</thead>.*?<tbody>(.*?)</tbody>',
            block, re.DOTALL
        )
        if not table:
            continue
            
        # Header: Level, HP, PATK, MATK, AGI ecc
        headers = re.findall(r'<th[^>]*>([^<]+)</th>', table.group(1))
        stat_keys = [STAT_MAP.get(h.strip()) for h in headers[1:]]  # salta "Level"
        
        rows = re.findall(r'<tr>(.*?)</tr>', table.group(2), re.DOTALL)
        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
            if not cells:
                continue
            # Level number
            level_text = re.sub(r'<[^>]+>', '', cells[0]).strip()
            try:
                level = int(level_text)
            except ValueError:
                continue
            
            level_stats = {}
            for i, key in enumerate(stat_keys):
                if key and i + 1 < len(cells):
                    val_text = re.sub(r'<[^>]+>', '', cells[i+1]).strip()
                    m = re.match(r'[+]?(\d+)', val_text)
                    if m:
                        level_stats[key] = int(m.group(1))
            
            if level_stats:
                gate_data["levels"].append({"level": level, "stats": level_stats})
        
        # Cerca anche Max Level Enhancement Stats
        max_table = re.search(
            r'Max Level Enhancement.*?<caption>Stats</caption>.*?<tbody>(.*?)</tbody>',
            block, re.DOTALL
        )
        if max_table:
            max_stats = {}
            max_rows = re.findall(r'<tr>(.*?)</tr>', max_table.group(1), re.DOTALL)
            for row in max_rows:
                cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL)
                if len(cells) >= 2:
                    stat_name = re.sub(r'<[^>]+>', '', cells[0]).strip()
                    val_text = re.sub(r'<[^>]+>', '', cells[1]).strip()
                    key = STAT_MAP.get(stat_name)
                    if key:
                        m = re.match(r'[+]?(\d+)', val_text)
                        if m:
                            max_stats[key] = int(m.group(1))
            if max_stats:
                gate_data["max_stats"] = max_stats
        
        if gate_data["levels"] or gate_data.get("max_stats"):
            gates[gate] = gate_data
    
    return gates


GATE_NAMES = ["envy", "sloth", "lust", "gluttony", "wrath", "greed", "pride"]
STAT_MAP_GATE = {
    "HP": "hp", "PATK": "atk", "PDEF": "def", "MATK": "mag",
    "MDEF": "mnd", "DEX": "dex", "AGI": "spd", "CRIT": "cri",
    "LUCK": "luk", "Jewels": "mp",
}

def extract_gates(content):
    gates = {}
    for gate in GATE_NAMES:
        section = re.search(
            rf'id="{gate}-gate"[^>]*>(.*?)(?=id="[a-z]+-gate"|$)',
            content, re.DOTALL
        )
        if not section:
            continue
        table = re.search(
            r'<caption>Stats</caption>.*?<thead>(.*?)</thead>(.*?)</tbody>',
            section.group(1), re.DOTALL
        )
        if not table:
            continue
        headers = re.findall(r'<th[^>]*>([^<]+)</th>', table.group(1))
        headers = [h.strip() for h in headers if h.strip() != "Level"]
        gate_levels = []
        rows = re.findall(r'<tr>\s*<th>(\d+)</th>(.*?)</tr>', table.group(2), re.DOTALL)
        for level, cells in rows:
            tds = re.findall(r'<td[^>]*>(.*?)</td>', cells, re.DOTALL)
            level_stats = {"level": int(level)}
            for i, td in enumerate(tds):
                td = re.sub(r'<[^>]+>', '', td).strip()
                if i < len(headers) and td.startswith('+'):
                    key = STAT_MAP_GATE.get(headers[i])
                    if key:
                        try: level_stats[key] = int(td[1:])
                        except: pass
            gate_levels.append(level_stats)
        if gate_levels:
            gates[gate] = gate_levels
    return gates


def extract_spirit_gear(content):
    """Estrae i bonus % dello spirit gear (sbloccato con Pride max)."""
    section = re.search(
        r'id="spirit"[^>]*>(.*?)(?=<div class="tab-pane main-pane"|$)',
        content, re.DOTALL
    )
    if not section:
        return []
    
    spirit_levels = []
    rows = re.findall(
        r'<th>(\d+)</th>\s*<td>(.*?)</td>',
        section.group(1), re.DOTALL
    )
    for level, cell in rows:
        cell_text = re.sub(r'<[^>]+>', ' ', cell).strip()
        bonuses = {}
        # Cerca pattern "STAT +X%" - es "HP +1%" o "MATK +5%"
        for m in re.finditer(r'(HP|PATK|PDEF|MATK|MDEF|DEX|AGI|CRIT|LUCK)\s*\+(\d+)%', cell_text):
            stat = m.group(1)
            val = int(m.group(2))
            stat_key = {"HP":"hp","PATK":"atk","PDEF":"def","MATK":"mag",
                       "MDEF":"mnd","DEX":"dex","AGI":"spd","CRIT":"cri",
                       "LUCK":"luk"}.get(stat)
            if stat_key:
                bonuses[stat_key] = bonuses.get(stat_key, 0) + val
        if bonuses:
            spirit_levels.append({"level": int(level), "bonuses": bonuses})
    
    return spirit_levels


def extract_gate_prerequisites(content):
    """Estrae i prerequisiti di ogni gate (es. Sloth richiede Envy Level 2)."""
    prereqs = {}
    GATE_NAMES_ALL = ["envy", "sloth", "lust", "gluttony", "wrath", "greed", "pride"]
    
    for gate in GATE_NAMES_ALL:
        section = re.search(
            rf'id="{gate}-gate"[^>]*>(.*?)(?=id="[a-z]+-gate"|$)',
            content, re.DOTALL
        )
        if not section:
            continue
        # Cerca la tabella Requirements
        req_section = re.search(
            r'Requirements.*?<tbody>(.*?)</tbody>',
            section.group(1), re.DOTALL
        )
        if req_section:
            req_text = re.sub(r'<[^>]+>', ' ', req_section.group(1)).strip()
            req_text = re.sub(r'\s+', ' ', req_text).strip()
            if req_text:
                prereqs[gate] = req_text  # es. "Sloth Level 3"
    
    return prereqs


def extract_passive_upgrades(content):
    """Estrae coppie new→old skill dai gate (tabelle New Skill / Old Skill)."""
    upgrades = {}
    GATE_NAMES_ALL = ["envy", "sloth", "lust", "gluttony", "wrath", "greed", "pride"]
    
    for gate in GATE_NAMES_ALL:
        section = re.search(
            rf'id="{gate}-gate"[^>]*>(.*?)(?=id="[a-z]+-gate"|$)',
            content, re.DOTALL
        )
        if not section:
            continue
        
        # Cerca blocchi "Max Level Enhancement (Ability)"
        ability_blocks = re.findall(
            r'Max Level Enhancement \(Ability\).*?(?=Max Level Enhancement|card-header nested-card-header|</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*<div class="card-header|$)',
            section.group(1), re.DOTALL
        )
        
        gate_upgrades = []
        for block in ability_blocks:
            # New Skill
            new_match = re.search(
                r'New Skill.*?<a href="([^"]+)">([^<]+)</a>.*?<tbody>.*?<tr>\s*<td>(.*?)</td>',
                block, re.DOTALL
            )
            # Old Skill
            old_match = re.search(
                r'Old Skill.*?<a href="([^"]+)">([^<]+)</a>',
                block, re.DOTALL
            )
            
            if new_match and old_match:
                new_desc = re.sub(r'<[^>]+>', ' ', new_match.group(3)).strip()
                new_desc = re.sub(r'\s+', ' ', new_desc).strip()

                # Estrai buff_stats dalla New Skill
                new_buff = {}
                BMAP = {
                    "HP":"hp","PATK":"atk","PDEF":"def","MATK":"mag","MDEF":"mnd",
                    "DEX":"dex","AGI":"spd","CRIT":"cri","LUCK":"luk","Jewels":"mp",
                    "PATK Power":"patk_power","MATK Power":"matk_power",
                    "Evasion Rate":"evasion","Hit Rate":"hit_rate",
                    "Healing Power":"heal_power","Slash ATK Power":"slash_power",
                    "Pierce ATK Power":"pierce_power","Missile ATK Power":"missile_power",
                    "Magic ATK Power":"magic_power","Buff Duration":"buff_dur",
                }
                cap_blocks = re.findall(
                    r'<caption>([^<]*)</caption>(.*?)</tbody>',
                    block, re.DOTALL
                )
                for cap, tbody in cap_blocks:
                    if "Condition" in cap: continue
                    if "Target" in cap and "Self" not in cap: continue
                    # Min/Max
                    for sn, _, mv in re.findall(
                        r'<th>([^<]+)</th>\s*<td[^>]*>([^<]*)</td>\s*<td[^>]*>([^<]+)</td>', tbody
                    ):
                        sn = sn.strip()
                        if sn in ("Type","Min","Max","Stats","Rate","Value"): continue
                        k = BMAP.get(sn)
                        if not k: continue
                        mc = re.sub(r'\s*\([^)]*\)', '', mv).strip()
                        vm = re.match(r'([+-])(\d+)(%?)', mc)
                        if vm:
                            sign = -1 if vm.group(1) == '-' else 1
                            new_buff[k] = {"val": sign * int(vm.group(2)), "pct": bool(vm.group(3))}
                    # colspan
                    for sn, v in re.findall(
                        r'<th>([^<]+)</th>\s*<td[^>]*colspan[^>]*>([^<]+)</td>', tbody
                    ):
                        sn = sn.strip()
                        if sn in ("Type","Min","Max","Stats","Rate","Value"): continue
                        k = BMAP.get(sn)
                        if not k: continue
                        vc = re.sub(r'\s*\([^)]*\)', '', v).strip()
                        vm = re.match(r'([+-])(\d+)(%?)', vc)
                        if vm:
                            sign = -1 if vm.group(1) == '-' else 1
                            new_buff[k] = {"val": sign * int(vm.group(2)), "pct": bool(vm.group(3))}

                gate_upgrades.append({
                    "new": {
                        "href": new_match.group(1),
                        "name": new_match.group(2).strip(),
                        "desc": new_desc,
                        "buff_stats": new_buff,
                    },
                    "old_name": old_match.group(2).strip(),
                })
        
        if gate_upgrades:
            upgrades[gate] = gate_upgrades
    
    return upgrades


STAT_MAP_BONUS = {
    "HP":"hp","PATK":"atk","PDEF":"def","MATK":"mag","MDEF":"mnd",
    "DEX":"dex","AGI":"spd","CRIT":"cri","LUCK":"luk","Jewels":"mp",
}

def extract_equipment_stats(content):
    """Estrae Primary Stats Equipment (flat) per ogni job section."""
    job_rows = re.findall(
        r'<th>((?:Chg )?Job \d+(?:\s*\(\d+\))?)\s*</th>.*?href="#(j\d+)"',
        content, re.DOTALL
    )
    
    job_sections = {}
    for label, job_id in job_rows:
        idx = content.find(f'id="{job_id}"')
        if idx < 0: continue
        next_idx = content.find('id="j', idx + 1)
        section = content[idx:next_idx if next_idx > 0 else idx+15000]
        
        eq_table = re.search(
            r'<caption>Primary Stats</caption>.*?<thead>.*?Equipment.*?</thead>(.*?)</tbody>',
            section, re.DOTALL
        )
        mb_table = re.search(r'Job Master Bonus</caption>.*?<tbody>(.*?)</tbody>', section, re.DOTALL)
        
        equipment = {}
        modifier = {}
        
        if eq_table:
            rows = re.findall(r'<th>([^<]+)</th>(.*?)(?=<tr>|</tbody>)', eq_table.group(1), re.DOTALL)
            for stat_name, cells in rows:
                tds = re.findall(r'<td[^>]*>([^<]*)</td>', cells)
                if len(tds) >= 2:
                    stat_name = stat_name.strip()
                    key = STAT_MAP_BONUS.get(stat_name)
                    if not key: continue
                    # Equipment (flat)
                    vm = re.match(r'([+-])(\d+)(?:%?)$', tds[0].strip())
                    if vm:
                        sign = -1 if vm.group(1) == '-' else 1
                        equipment[key] = sign * int(vm.group(2))
                    # Modifier (%)
                    vm2 = re.match(r'([+-])(\d+)%', tds[1].strip())
                    if vm2:
                        sign = -1 if vm2.group(1) == '-' else 1
                        modifier[key] = sign * int(vm2.group(2))
        
        master_bonus = {}
        if mb_table:
            rows = re.findall(r'<th>([^<]+)</th>\s*<td>([^<]+)</td>', mb_table.group(1))
            for stat_name, val in rows:
                key = STAT_MAP_BONUS.get(stat_name.strip())
                if not key: continue
                vm = re.match(r'([+-])(\d+)(%?)', val.strip())
                if vm:
                    sign = -1 if vm.group(1) == '-' else 1
                    if vm.group(3):  # percentuale
                        master_bonus[key] = {"val": sign * int(vm.group(2)), "pct": True}
                    else:  # flat
                        master_bonus[key] = {"val": sign * int(vm.group(2)), "pct": False}
        
        job_sections[job_id] = {
            "label": label.strip(),
            "equipment": equipment,
            "modifier": modifier,
            "master_bonus": master_bonus,
        }
    
    return job_sections


def get_most_advanced_jobs(job_sections):
    """
    Determina la versione più avanzata per ogni job base (1, 2, 3).
    Job 1 → Chg Job 1 → Chg Job 1 (2) → Chg Job 1 (3) (prende l'ultima)
    """
    # Raggruppa per job base
    base_jobs = {}
    for job_id, info in job_sections.items():
        label = info["label"]
        # Estrai numero base del job
        m = re.match(r'(?:Chg )?Job (\d+)', label)
        if m:
            base_num = int(m.group(1))
            if base_num not in base_jobs:
                base_jobs[base_num] = []
            base_jobs[base_num].append((job_id, label, info))
    
    # Per ogni job base, prendi la versione più avanzata
    result = {}
    for base_num, versions in base_jobs.items():
        # Ordina: Job N viene prima, poi Chg Job N, poi Chg Job N (2), ecc.
        def sort_key(item):
            label = item[1]
            if label == f"Job {base_num}": return 0
            if label == f"Chg Job {base_num}": return 1
            m = re.match(r'Chg Job \d+\s*\((\d+)\)', label)
            if m: return int(m.group(1))
            return 99
        versions.sort(key=sort_key)
        # Prendi l'ultima (più avanzata)
        result[base_num] = versions[-1][2]  # info dict
    
    return result


def extract_enlightened_bond(content):
    """Estrae i livelli di Enlightened Bond."""
    bond_idx = content.find('Enlightened Bond</div>')
    if bond_idx < 0:
        return {"name": "", "levels": []}
    
    bond_section = content[bond_idx:bond_idx+20000]
    
    # Nome del bond
    name_m = re.search(r'<caption>([^<]+)</caption>', bond_section)
    bond_name = name_m.group(1).strip() if name_m else ""
    
    # Livelli e stat
    levels = []
    level_rows = re.findall(r'<th>(\d+)</th>\s*<td>(.*?)</td>\s*<td>', bond_section, re.DOTALL)
    
    BOND_STAT_MAP = {
        "HP": "hp", "PATK": "atk", "PDEF": "def", "MATK": "mag", "MDEF": "mnd",
        "DEX": "dex", "AGI": "spd", "CRIT": "cri", "LUCK": "luk", "Jewels": "mp",
        "Max Jewels": "mp", "Slash ATK Power": "slash_power",
        "Pierce ATK Power": "pierce_power", "Missile ATK Power": "missile_power",
        "Magic ATK Power": "magic_power", "Single Target ATK": "single_target_atk",
        "Area ATK": "area_atk", "Evasion Rate": "evasion", "Hit Rate": "hit_rate",
        "PATK Power": "patk_power", "MATK Power": "matk_power",
        "Critical Rate": "crit_rate", "Healing Power": "heal_power",
    }
    
    for level, stats_html in level_rows:
        stats_text = re.sub(r'<[^>]+>', ' ', stats_html).strip()
        stats_text = re.sub(r'\s+', ' ', stats_text)
        
        stats = {}
        # Cerca pattern "STAT NAME +N%" o "STAT NAME +N"
        for stat_name, key in BOND_STAT_MAP.items():
            pattern = re.escape(stat_name) + r'\s*([+-])(\d+)(%?)'
            m = re.search(pattern, stats_text)
            if m:
                sign = -1 if m.group(1) == '-' else 1
                val = sign * int(m.group(2))
                is_pct = bool(m.group(3))
                if key in stats:
                    stats[key] = {"val": stats[key]["val"] + val, "pct": is_pct}
                else:
                    stats[key] = {"val": val, "pct": is_pct}
        
        if stats:
            levels.append({"level": int(level), "stats": stats})
    
    return {"name": bond_name, "levels": levels}

def extract_unit_data(html_path, slug):
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"  [ERROR] {e}")
        return None

    data = {"iname": slug}

    # Nome unità
    m = re.search(r'<h1>([^<]+)</h1>', content)
    if m:
        data["name"] = m.group(1).strip()

    # Immagine portrait
    m = re.search(r'class="profile-icon"[^>]*src="[^"]*Portraits[MC]?/([^"./]+)\.png"', content)
    if m:
        data["img"] = m.group(1)
    else:
        data["img"] = slug

    # Elemento
    m = re.search(r'data-tippy-content="([^"]+)"\s+class="element-icon', content)
    if m:
        elem_name = m.group(1)
        data["elem"] = ELEM_MAP.get(elem_name, 0)
        data["elem_name"] = elem_name
    else:
        data["elem"] = 0

    # High element (JP)
    m = re.search(r'data-tippy-content="([^"]+)"\s+class="high-element-icon', content)
    if m:
        data["high_elem"] = 1

    # Origine/Birth
    m = re.search(r'data-tippy-content="([^"]+)"\s+class="flag-icon', content)
    if m:
        birth_name = m.group(1)
        data["birth"] = BIRTH_MAP.get(birth_name, 100)
        data["birth_name"] = birth_name

    # Sesso (dalla tabella Type)
    m = re.search(r'<th>Type</th>\s*<td>([\s\S]*?)</td>', content)
    if m:
        type_text = m.group(1)
        if "Female" in type_text:
            data["sex"] = 2
        elif "Male" in type_text:
            data["sex"] = 1
        else:
            data["sex"] = 0

    # Stats base dalla prima tabella stats (Min/Max)
    # Cerca la caption "Primary Stats" con colonne Type/Min/Max
    stats_section = re.search(
        r'<caption>Primary Stats</caption>.*?<thead>.*?<th scope="col">Min</th>.*?</thead>(.*?)</tbody>',
        content, re.DOTALL
    )
    if stats_section:
        rows = re.findall(r'<th>([^<]+)</th>\s*<td>(\d+)</td>\s*<td>(\d+)</td>', stats_section.group(1))
        for stat_name, min_val, max_val in rows:
            stat_name = stat_name.strip()
            if stat_name in STAT_MAP:
                min_key, max_key = STAT_MAP[stat_name]
                data[min_key] = int(min_val)
                data[max_key] = int(max_val)

    # Jobs dalla sidebar
    jobs_data = []
    jobsets_data = []

    # Cerca tutti i job nella tabella (Job 1, Job 2, ..., Chg Job 1, ...)
    job_rows = re.findall(
        r'<th>((?:Chg )?Job \d+)</th>\s*<td>.*?href="#(j\d+)"[^>]*>.*?'
        r'src="[^"]*JobIcon/([^"./]+)\.png"[^>]*/>\s*<div>([^<]+)</div>',
        content, re.DOTALL
    )

    job_index = 0
    for job_label, job_anchor, icon, job_name in job_rows:
        job_name = job_name.strip()
        is_change = "Chg" in job_label
        iname = icon.lower()

        job_entry = {
            "iname": iname,
            "mdl": icon,
            "name": job_name,
            "hp": 0, "mp": 0, "atk": 0, "def": 0,
            "mag": 0, "mnd": 0, "dex": 0, "spd": 0,
            "cri": 0, "luk": 0,
            "jmov": 3, "jjmp": 3, "avoid": 0,
            "ranks_stats": {},
            "master_data": {"t_buff_data": {}},
        }

        jobset_entry = {
            "job": iname,
            "iname": f"{slug}_{iname}",
        }
        if is_change:
            # Trova il job base a cui appartiene questo change job
            # I change job vengono dopo i 3 base job
            base_idx = job_index - (3 if len(job_rows) > 3 else len([r for r in job_rows if "Chg" not in r[0]]))
            if base_idx >= 0 and base_idx < len(jobsets_data):
                jobset_entry["cjob"] = jobsets_data[0]["job"]
            jobset_entry["ejob"] = iname

        jobs_data.append(job_entry)
        jobsets_data.append(jobset_entry)
        job_index += 1

    # Se non abbiamo trovato jobs, crea un placeholder
    if not jobs_data:
        jobs_data = [{
            "iname": slug, "mdl": slug, "name": "Unknown",
            "hp": 0, "mp": 0, "atk": 0, "def": 0,
            "mag": 0, "mnd": 0, "dex": 0, "spd": 0,
            "cri": 0, "luk": 0, "jmov": 3, "jjmp": 3, "avoid": 0,
            "ranks_stats": {},
            "master_data": {"t_buff_data": {}},
        }]
        jobsets_data = [{"job": slug, "iname": slug}]

    data["jobs_data"] = jobs_data
    data["jobsets_data"] = jobsets_data

    # Max level
    m = re.search(r'<th>Max Level</th>\s*<td>(\d+)</td>', content)
    if m:
        data["max_level"] = int(m.group(1))
    else:
        data["max_level"] = 99

    # Lista unica di tutte le passive (senza duplicati, senza Reaction)
    all_passives = []
    seen = set()
    for job in data["jobs_data"]:
        for p in job.get("passives", []):
            key = p["name"]
            if key not in seen:
                seen.add(key)
                all_passives.append(p)
    data["all_passives"] = all_passives

    # Gate/Enlightenment
    data["gates"] = extract_gates(content)

    # Gear e Mementos consigliati
    data["recommended_gear"] = extract_recommended_gear(content)
    data["recommended_mementos"] = extract_recommended_mementos(content)

    # Leader Skill e Master Ability
    lm = extract_leader_master(content)
    data.update(lm)

    # Passive per job
    job_inames = [j["iname"] for j in data.get("jobs_data", [])]
    passives = extract_passives_for_jobs(content, job_inames)
    for job in data.get("jobs_data", []):
        job["passives"] = passives.get(job["iname"], [])

    # Lista unica di tutte le passive (senza duplicati, senza Reaction)
    all_passives = []
    seen = set()
    for job in data["jobs_data"]:
        for p in job.get("passives", []):
            key = p["name"]
            if key not in seen:
                seen.add(key)
                all_passives.append(p)
    data["all_passives"] = all_passives

    # Gate/Enlightenment
    data["gates"] = extract_gates(content)
    data["gate_prereqs"] = extract_gate_prerequisites(content)
    data["gate_passive_upgrades"] = extract_passive_upgrades(content)

    # Spirit Gear (sbloccato con Pride max)
    data["spirit_gear"] = extract_spirit_gear(content)

    # Equipment Stats e Master Bonus per job
    job_sections = extract_equipment_stats(content)
    data["job_sections"] = job_sections
    # Versioni più avanzate dei 3 job base
    advanced_jobs = get_most_advanced_jobs(job_sections)
    data["advanced_jobs"] = {str(k): v for k, v in advanced_jobs.items()}

    # Enlightened Bond
    data["enlightened_bond"] = extract_enlightened_bond(content)

    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("site_root", help="Cartella radice del sito")
    parser.add_argument("--slug", default=None, help="Processa solo questo slug (test)")
    parser.add_argument("--locale", default="en", choices=["en", "jp"])
    args = parser.parse_args()

    site_root = Path(args.site_root).resolve()
    if args.locale == "jp":
        unit_dir = site_root / "www.alchemistcodedb.com" / "jp" / "unit"
        api_dir  = site_root / "www.alchemistcodedb.com" / "jp" / "api"
    else:
        unit_dir = site_root / "www.alchemistcodedb.com" / "unit"
        api_dir  = site_root / "www.alchemistcodedb.com" / "api"

    api_dir.mkdir(parents=True, exist_ok=True)

    if args.slug:
        html_files = [unit_dir / f"{args.slug}.html"]
    else:
        html_files = list(unit_dir.glob("*.html"))

    print(f"Unit dir : {unit_dir}")
    print(f"API dir  : {api_dir}")
    print(f"File     : {len(html_files)}")
    print()

    ok = 0
    fail = 0

    for html_file in html_files:
        slug = html_file.stem
        if not html_file.exists():
            print(f"  [SKIP] {slug} — file non trovato")
            fail += 1
            continue

        data = extract_unit_data(html_file, slug)
        if not data:
            fail += 1
            continue

        out = api_dir / f"unit_{slug}.json"
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        ok += 1
        if args.slug:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            print(f"  ✔ {slug}")

    print()
    print(f"OK: {ok}  Falliti: {fail}")
    print(f"\nJSON salvati in: {api_dir}")


if __name__ == "__main__":
    main()
# PATCH: aggiunte estrazioni passive, gear, mementos
