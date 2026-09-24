(function() {
  var unitData = null;
  var locale = "en";
  var selectedGear = [null, null, null];
  var selectedCard = null;
  var selectedCard2 = null;
  var gateValues = {};
  var spiritGearLevel = 0;
  var GATE_ORDER = ["envy","sloth","lust","gluttony","wrath","greed","pride"];

  // Listener globale per i bottoni passive — registrato una sola volta
  document.addEventListener("click", function(e) {
    var btn = e.target.closest(".acdb-passive-btn");
    if (!btn) return;
    e.preventDefault();
    var idx = parseInt(btn.dataset.idx);
    var jobKey = btn.dataset.job || "unit";
    if (!selectedPassives[jobKey]) selectedPassives[jobKey] = [];
    var sel = selectedPassives[jobKey];
    var pos = sel.indexOf(idx);
    if (pos !== -1) { sel.splice(pos, 1); }
    else { if (sel.length >= 2) sel.shift(); sel.push(idx); }
    updatePassivePanel();
    updateStats();
  });

  function decodeHtml(str) {
    var d = document.createElement("div");
    d.innerHTML = str;
    return d.textContent || d.innerText || str;
  }
  function mkEl(tag, cls, style, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (style) el.style.cssText = style;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function mkLink(href, text) {
    var a = mkEl("a");
    a.href = href;
    a.textContent = decodeHtml(text);
    return a;
  }

  var STAT_KEYS = {
    "HP":    {min:"hp",  max:"mhp"},
    "PATK":  {min:"atk", max:"matk"},
    "PDEF":  {min:"def", max:"mdef"},
    "MATK":  {min:"mag", max:"mmag"},
    "MDEF":  {min:"mnd", max:"mmnd"},
    "DEX":   {min:"dex", max:"mdex"},
    "AGI":   {min:"spd", max:"mspd"},
    "CRIT":  {min:"cri", max:"mcri"},
    "LUCK":  {min:"luk", max:"mluk"},
    "Jewels":{min:"mp",  max:"mmp"},
  };
  var KEY_TO_STAT = {
    hp:"HP", atk:"PATK", def:"PDEF", mag:"MATK", mnd:"MDEF",
    dex:"DEX", spd:"AGI", cri:"CRIT", luk:"LUCK", mp:"Jewels"
  };

  // ── CALCOLO ──────────────────────────────────────────────────────────────
  // Calcola il livello massimo effettivo basato sui gate sbloccati
  function getEffectiveMaxLevel() {
    if (!unitData || !unitData.gates) return unitData ? (unitData.max_level || 99) : 99;
    var baseMax = 85;
    var gateMax = unitData.max_level || 99;
    // Ogni gate sbloccato (anche solo livello 1) aggiunge 2 livelli
    var unlockedGates = GATE_ORDER.filter(function(g) {
      return (gateValues[g] || 0) >= 1;
    }).length;
    var effectiveMax = Math.min(baseMax + unlockedGates * 2, gateMax);
    return effectiveMax;
  }

  function calcBaseStats(level) {
    if (!unitData) return {};
    var maxLevel = unitData.max_level || 99;
    var result = {};
    for (var stat in STAT_KEYS) {
      var k = STAT_KEYS[stat];
      var minV = unitData[k.min] || 0;
      var maxV = unitData[k.max] || 0;
      result[stat] = maxLevel <= 1 ? maxV :
        Math.round(minV + (maxV - minV) * (level - 1) / (maxLevel - 1));
    }
    return result;
  }

  function getJobBonus(baseStats) {
    // Equipment flat + Modifier % + Master Bonus da tutti e 3 i job avanzati
    var flatBonus = {};
    var pctBonus = {};
    var masterBonus = {};
    if (!unitData || !unitData.advanced_jobs) return {flat: flatBonus, pct: pctBonus, master: masterBonus};

    Object.keys(unitData.advanced_jobs).forEach(function(jobNum) {
      var job = unitData.advanced_jobs[jobNum];
      // Equipment (flat)
      Object.keys(job.equipment || {}).forEach(function(k) {
        flatBonus[k] = (flatBonus[k] || 0) + job.equipment[k];
      });
      // Modifier (%)
      Object.keys(job.modifier || {}).forEach(function(k) {
        pctBonus[k] = (pctBonus[k] || 0) + job.modifier[k];
      });
      // Master Bonus
      Object.keys(job.master_bonus || {}).forEach(function(k) {
        var entry = job.master_bonus[k];
        if (!masterBonus[k]) masterBonus[k] = {val: 0, pct: entry.pct};
        masterBonus[k].val += entry.val;
      });
    });
    return {flat: flatBonus, pct: pctBonus, master: masterBonus};
  }

  var bondLevel = 0;

  function getBondBonus(baseStats) {
    var bonus = {};
    var extraBonus = {};
    if (!unitData || !unitData.enlightened_bond || !bondLevel) return {main: bonus, extra: extraBonus};
    var MAIN_KEYS = {"hp":"HP","atk":"PATK","def":"PDEF","mag":"MATK","mnd":"MDEF",
                     "dex":"DEX","spd":"AGI","cri":"CRIT","luk":"LUCK","mp":"Jewels"};
    unitData.enlightened_bond.levels.forEach(function(row) {
      if (row.level > bondLevel) return;
      Object.keys(row.stats).forEach(function(k) {
        var entry = row.stats[k];
        var val = entry.val;
        var isPct = entry.pct;
        var statName = MAIN_KEYS[k];
        if (statName) {
          var total = isPct ? Math.round((baseStats[statName] || 0) * val / 100) : val;
          bonus[statName] = (bonus[statName] || 0) + total;
        } else {
          extraBonus[k] = (extraBonus[k] || 0) + val;
        }
      });
    });
    return {main: bonus, extra: extraBonus};
  }

  var bonusHP = 0;
  var runeData = null;       // dati globali rune (caricati una volta)
  var selectedRunes = {};    // {slot: {set_slug, rarity}} slot 1-6
  var RARITY_ORDER = ["ssr", "sr", "r"];

  function loadRuneData(callback) {
    if (runeData) { callback(runeData); return; }
    fetch("/get-rune-data?locale=" + locale)
      .then(function(r) { return r.json(); })
      .then(function(d) { runeData = d; callback(d); })
      .catch(function() { callback(null); });
  }

  function getRuneBonus(baseStats) {
    var bonus = {};
    var extraBonus = {};
    if (!runeData) return {main: bonus, extra: extraBonus};
    var MAIN_KEYS = {"hp":"HP","atk":"PATK","def":"PDEF","mag":"MATK","mnd":"MDEF",
                     "dex":"DEX","spd":"AGI","cri":"CRIT","luk":"LUCK","mp":"Jewels"};

    function applyStatEntry(k, entry) {
      // entry può essere numero (flat) o {val, pct}
      var val, isPct;
      if (typeof entry === "object" && entry !== null) {
        val = entry.val || 0; isPct = entry.pct || false;
      } else {
        val = entry; isPct = false;
      }
      var statName = MAIN_KEYS[k];
      if (statName) {
        var total = isPct ? Math.round((baseStats[statName] || 0) * val / 100) : val;
        bonus[statName] = (bonus[statName] || 0) + total;
      } else {
        extraBonus[k] = (extraBonus[k] || 0) + (isPct ? val : val); // extra stat: mostra valore raw
      }
    }

    // Bonus stat da ogni runa selezionata
    for (var slot = 1; slot <= 6; slot++) {
      var sel = selectedRunes[slot];
      if (!sel || !sel.statKey) continue;  // statKey vuoto = Off
      var sinName = runeData.slot_to_sin ? runeData.slot_to_sin[String(slot)] : null;
      if (!sinName) continue;
      var sinData = runeData.sins[sinName];
      if (!sinData) continue;
      // Trova entry per rarità e statKey
      var rarData = sinData[sel.rarity || "ssr"] || sinData.ssr || [];
      var entry = null;
      for (var ei = 0; ei < rarData.length; ei++) {
        if (Object.keys(rarData[ei].stats)[0] === sel.statKey) {
          entry = rarData[ei]; break;
        }
      }
      if (!entry) entry = rarData[0];  // fallback
      if (!entry) continue;
      for (var k in entry.stats) {
        var statName = MAIN_KEYS[k];
        if (statName) bonus[statName] = (bonus[statName] || 0) + entry.stats[k];
        else extraBonus[k] = (extraBonus[k] || 0) + entry.stats[k];
      }
    }

    // Bonus set effect — conta solo le rune con stat selezionata (On)
    var setCount = {};
    for (var slot2 = 1; slot2 <= 6; slot2++) {
      var sel2 = selectedRunes[slot2];
      if (!sel2 || !sel2.statKey) continue;  // skip se Off
      setCount[sel2.set_slug] = (setCount[sel2.set_slug] || 0) + 1;
    }
    for (var setSlug in setCount) {
      var setInfo = runeData.sets[setSlug];
      if (!setInfo || !setInfo.n_seals) continue;
      if (setCount[setSlug] >= setInfo.n_seals) {
        for (var k in setInfo.stats) {
          applyStatEntry(k, setInfo.stats[k]);
        }
      }
    }
    return {main: bonus, extra: extraBonus};
  }

  function getGateBonus() {
    var bonus = {};
    if (!unitData || !unitData.gates) return bonus;
    for (var gate in gateValues) {
      var level = gateValues[gate];
      if (!level || !unitData.gates[gate]) continue;
      var row = unitData.gates[gate].find(function(r) { return r.level === level; });
      if (!row) continue;
      for (var k in row) {
        if (k === "level") continue;
        var statName = KEY_TO_STAT[k];
        if (statName) bonus[statName] = (bonus[statName] || 0) + row[k];
      }
    }
    return bonus;
  }

  function getSpiritGearBonus(baseStats) {
    // Bonus % cumulativi fino al livello selezionato
    var pct = {};
    if (!unitData || !unitData.spirit_gear || !spiritGearLevel) return {};
    unitData.spirit_gear.forEach(function(row) {
      if (row.level > spiritGearLevel) return;
      for (var k in row.bonuses) {
        pct[k] = (pct[k] || 0) + row.bonuses[k];
      }
    });
    var bonus = {};
    for (var k in pct) {
      var statName = KEY_TO_STAT[k];
      if (statName && baseStats[statName]) {
        bonus[statName] = Math.round(baseStats[statName] * pct[k] / 100);
      }
    }
    return bonus;
  }

  function getGearBonus() {
    var bonus = {};
    selectedGear.forEach(function(g) {
      if (!g) return;
      // Usa numeric_stats dal JSON unit se disponibile, altrimenti stats dall'API
      var stats = g.numeric_stats || g.stats || {};
      for (var k in stats) {
        var statName = KEY_TO_STAT[k];
        if (statName) bonus[statName] = (bonus[statName] || 0) + stats[k];
      }
    });
    return bonus;
  }

  function getCardBonus() {
    var bonus = {};
    [[selectedCard, 1.0], [selectedCard2, 0.5]].forEach(function(pair) {
      var c = pair[0], mult = pair[1];
      if (!c) return;
      var stats = c.numeric_stats || c.stats || {};
      for (var k in stats) {
        var statName = KEY_TO_STAT[k];
        if (statName) bonus[statName] = (bonus[statName] || 0) + Math.floor(stats[k] * mult);
      }
    });
    return bonus;
  }

  // Cache skill JSON (fallback quando buff_stats è vuoto nel JSON unit)
  var skillCache = {};

  function applySkillData(skillData, baseStats, bonus, extraBonus) {
    var MAIN_KEYS = {"hp":"HP","atk":"PATK","def":"PDEF","mag":"MATK","mnd":"MDEF",
                     "dex":"DEX","spd":"AGI","cri":"CRIT","luk":"LUCK","mp":"Jewels"};
    if (skillData.main_stats) {
      Object.keys(skillData.main_stats).forEach(function(k) {
        var entry = skillData.main_stats[k];
        var statName = MAIN_KEYS[k];
        if (!statName) return;
        var flat = entry.flat || 0;
        var scale = entry.scale || 0;
        var base = baseStats[statName] || 0;
        var total = flat + Math.round(base * scale / 100);
        bonus[statName] = (bonus[statName] || 0) + total;
      });
    }
    if (skillData.extra_stats) {
      Object.keys(skillData.extra_stats).forEach(function(k) {
        var entry = skillData.extra_stats[k];
        var val = (entry.flat || 0) + (entry.scale || 0);
        if (val) extraBonus[k] = (extraBonus[k] || 0) + val;
      });
    }
  }

  function applyBuffStats(buffStats, baseStats, bonus, extraBonus) {
    var MAIN_KEYS = {"hp":"HP","atk":"PATK","def":"PDEF","mag":"MATK","mnd":"MDEF",
                     "dex":"DEX","spd":"AGI","cri":"CRIT","luk":"LUCK","mp":"Jewels"};
    Object.keys(buffStats).forEach(function(k) {
      var entry = buffStats[k];
      var val = entry.val || 0;
      var isPct = entry.pct || false;
      var statName = MAIN_KEYS[k];
      if (statName) {
        var total = isPct ? Math.round((baseStats[statName] || 0) * val / 100) : val;
        bonus[statName] = (bonus[statName] || 0) + total;
      } else {
        extraBonus[k] = (extraBonus[k] || 0) + val;
      }
    });
  }

  // Calcolo bonus passive
  function getPassiveBonus(baseStats) {
    var bonus = {};
    var extraBonus = {};
    var sel = selectedPassives["unit"] || [];
    if (!unitData || !unitData.all_passives || !sel.length) return {main: bonus, extra: extraBonus};

    var replacements = {};
    if (unitData.gate_passive_upgrades) {
      Object.keys(unitData.gate_passive_upgrades).forEach(function(gate) {
        if (!isGateUnlocked(gate)) return;
        var maxLv = getMaxGateLevel(gate);
        if ((gateValues[gate] || 0) < maxLv) return;
        unitData.gate_passive_upgrades[gate].forEach(function(u) {
          if (u.old_name && u.new) replacements[u.old_name] = u.new;
        });
      });
    }

    sel.forEach(function(idx) {
      var p = unitData.all_passives[idx];
      if (!p) return;
      var upgraded = replacements[p.name];
      var skillObj = upgraded || p;
      var buffStats = skillObj.buff_stats || {};

      if (Object.keys(buffStats).length > 0) {
        // Dati disponibili nel JSON unit
        applyBuffStats(buffStats, baseStats, bonus, extraBonus);
      } else if (skillObj.skill_slug && skillCache[skillObj.skill_slug]) {
        // Fallback: usa skill JSON dalla cache
        applySkillData(skillCache[skillObj.skill_slug], baseStats, bonus, extraBonus);
      } else if (skillObj.skill_slug && skillCache[skillObj.skill_slug] === undefined) {
        // Carica skill JSON async e ricalcola
        skillCache[skillObj.skill_slug] = null; // segna come in caricamento
        fetch("/get-skill-stats?slug=" + skillObj.skill_slug + "&locale=" + locale)
          .then(function(r) { return r.json(); })
          .then(function(d) {
            if (!d.error) {
              skillCache[skillObj.skill_slug] = d;
              updateStats(); // ricalcola con i nuovi dati
            } else {
              skillCache[skillObj.skill_slug] = null;
            }
          })
          .catch(function() { skillCache[skillObj.skill_slug] = null; });
      }
    });
    return {main: bonus, extra: extraBonus};
  }

  function updateStats() {
    var levelEl = document.getElementById("levelSelect");
    if (!levelEl) return;
    var extraLvlEl = document.getElementById("acdb-level-extra");
    var level = (extraLvlEl && extraLvlEl.value) ? parseInt(extraLvlEl.value) : (parseInt(levelEl.value) || 85);
    // Aggiorna max livello slider
    var maxLevel = getEffectiveMaxLevel();
    // Aggiorna le opzioni del select livello se serve
    if (levelEl.tagName === "SELECT") {
      var currentMax = parseInt(levelEl.options[levelEl.options.length-1].value) || 85;
      if (currentMax !== maxLevel) {
        // Ricostruisci le opzioni fino al nuovo max
        var curVal = parseInt(levelEl.value) || 85;
        levelEl.innerHTML = "";
        for (var li = 1; li <= maxLevel; li++) {
          var opt = document.createElement("option");
          opt.value = li; opt.textContent = li;
          levelEl.appendChild(opt);
        }
        levelEl.value = Math.min(curVal, maxLevel);
      }
    } else {
      levelEl.max = maxLevel;
    }
    if (level > maxLevel) { level = maxLevel; levelEl.value = maxLevel; }

    var base = calcBaseStats(level);
    var gate = getGateBonus();
    var spirit = getSpiritGearBonus(base);
    var gear = getGearBonus();
    var card = getCardBonus();
    var passiveResult = getPassiveBonus(base);
    var jobBonus = getJobBonus(base);
    var bondResult = getBondBonus(base);
    var runeResult = getRuneBonus(base);

    // Merge extra bonuses
    var allExtra = Object.assign({}, passiveResult.extra);
    Object.keys(bondResult.extra).forEach(function(k) {
      allExtra[k] = (allExtra[k] || 0) + bondResult.extra[k];
    });
    Object.keys(runeResult.extra).forEach(function(k) {
      allExtra[k] = (allExtra[k] || 0) + runeResult.extra[k];
    });

    updateAcdbPanel(base, gate, spirit, gear, card,
      passiveResult.main, allExtra,
      jobBonus, bondResult.main, bonusHP, runeResult.main);
  }
  function updateAcdbPanel(base, gate, spirit, gear, card, passive, extra, jobBonus, bondBonus, bonusHP, runeBonus) {
    passive = passive || {};
    extra = extra || {};
    jobBonus = jobBonus || {flat:{}, pct:{}, master:{}};
    bondBonus = bondBonus || {};
    bonusHP = bonusHP || 0;
    var KEY_MAP = {"HP":"hp","PATK":"atk","PDEF":"def","MATK":"mag","MDEF":"mnd",
                   "DEX":"dex","AGI":"spd","CRIT":"cri","LUCK":"luk","Jewels":"mp"};
    var power = passive._power || {};
    var panel = document.getElementById("acdb-stats-panel");
    if (!panel) return;
    var tbody = panel.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    for (var stat in STAT_KEYS) {
      var b = base[stat] || 0;
      var k = KEY_MAP[stat];
      // Job: equipment flat + modifier % + master bonus
      var jobFlat = jobBonus.flat[k] || 0;
      var jobPct = jobBonus.pct[k] || 0;
      var jobMaster = jobBonus.master[k];
      var jobMasterVal = jobMaster ? (jobMaster.pct ? Math.round(b * jobMaster.val / 100) : jobMaster.val) : 0;
      var jobTotal = jobFlat + Math.round(b * jobPct / 100) + jobMasterVal;
      // Bonus HP fisso
      var hpBonus = (stat === "HP") ? bonusHP : 0;
      var runeBonus2 = runeBonus ? (runeBonus[stat]||0) : 0;
      var bonus = (gate[stat]||0) + (spirit[stat]||0) + (gear[stat]||0) + (card[stat]||0) +
                  (passive[stat]||0) + jobTotal + (bondBonus[stat]||0) + hpBonus + runeBonus2;
      var total = b + bonus;
      var tr = document.createElement("tr");
      var bonusStr = bonus > 0 ?
        (' <span style="color:#6f6;font-size:0.8em">+' + bonus + '</span>') : '';
      tr.innerHTML = '<td style="opacity:0.65;padding:2px 6px">' + stat + '</td>' +
                     '<td style="text-align:right;font-weight:bold;padding:2px 6px">' +
                     total + bonusStr + '</td>';
      tbody.appendChild(tr);
    }
    // Mostra extra stats separatamente
    var power = extra;
    if (Object.keys(power).length > 0) {
      var sep = document.createElement("tr");
      sep.innerHTML = '<td colspan="2" style="opacity:0.4;font-size:0.75em;padding:4px 6px 1px">— Other Bonuses —</td>';
      tbody.appendChild(sep);
      for (var pk in power) {
        if (!power[pk]) continue;
        var tr2 = document.createElement("tr");
        tr2.innerHTML = '<td style="opacity:0.55;padding:2px 6px;font-size:0.85em">' + pk + '</td>' +
                        '<td style="text-align:right;font-weight:bold;padding:2px 6px;color:#aef">+' + power[pk] + '</td>';
        tbody.appendChild(tr2);
      }
    }
  }

  // ── GATE UI ───────────────────────────────────────────────────────────────
  function getGatePrereq(gate) {
    if (!unitData || !unitData.gate_prereqs) return null;
    var req = unitData.gate_prereqs[gate];
    if (!req) return null;
    // "Envy Level 3" → {gate: "envy", level: 3}
    var m = req.match(/(\w+)\s+Level\s+(\d+)/i);
    if (!m) return null;
    return {gate: m[1].toLowerCase(), level: parseInt(m[2])};
  }

  function isGateUnlocked(gate) {
    var prereq = getGatePrereq(gate);
    if (!prereq) return true;
    return (gateValues[prereq.gate] || 0) >= prereq.level;
  }

  function getMaxGateLevel(gate) {
    if (!unitData || !unitData.gates || !unitData.gates[gate]) return 0;
    return unitData.gates[gate].length;
  }

  function buildGateUI() {
    if (!unitData || !unitData.gates) return "";
    var html = '<div id="acdb-gate-ui" style="margin-top:8px">';
    html += '<div class="planner-header" style="font-size:0.75em">Gate (Enlightenment)</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:0.8em">';
    GATE_ORDER.forEach(function(gate) {
      if (!unitData.gates[gate]) return;
      var maxLevel = getMaxGateLevel(gate);
      var prereq = getGatePrereq(gate);
      var locked = !isGateUnlocked(gate);
      html += '<div style="display:flex;align-items:center;gap:4px">';
      html += '<span style="opacity:0.7;min-width:58px;text-transform:capitalize">' + gate + '</span>';
      html += '<select class="acdb-gate-select" data-gate="' + gate + '" ' +
              (locked ? 'disabled title="Requires ' + (prereq ? prereq.gate + ' Lv' + prereq.level : '') + '"' : '') +
              ' style="flex:1;background:' + (locked ? '#111' : '#1a1a3a') +
              ';color:' + (locked ? '#555' : '#eee') +
              ';border:1px solid #444;border-radius:3px;padding:1px">';
      html += '<option value="0">-</option>';
      for (var i = 1; i <= maxLevel; i++) {
        html += '<option value="' + i + '">' + i + '</option>';
      }
      html += '</select></div>';
    });
    html += '</div></div>';
    return html;
  }

  function refreshExtraLevelSelect() {
    var unitMaxLevel3 = unitData ? (unitData.max_level || 99) : 99;
    var effectiveMax = getEffectiveMaxLevel();
    var extraSel2 = document.getElementById("acdb-level-extra");
    if (!extraSel2 || unitMaxLevel3 <= 85) return;
    // Aggiorna le opzioni se il max effettivo è cambiato
    var curVal2 = extraSel2.value;
    extraSel2.innerHTML = "";
    var opt00 = document.createElement("option");
    opt00.value = ""; opt00.textContent = "86+";
    extraSel2.appendChild(opt00);
    for (var lv3 = 86; lv3 <= effectiveMax; lv3++) {
      var opt3 = document.createElement("option");
      opt3.value = lv3; opt3.textContent = lv3;
      extraSel2.appendChild(opt3);
    }
    if (curVal2 && parseInt(curVal2) <= effectiveMax) extraSel2.value = curVal2;
  }

  function refreshExtraLevelSelect() {
    var unitMaxLevel3 = unitData ? (unitData.max_level || 99) : 99;
    var effectiveMax = getEffectiveMaxLevel();
    var extraSel2 = document.getElementById("acdb-level-extra");
    if (!extraSel2 || unitMaxLevel3 <= 85) return;
    // Aggiorna le opzioni se il max effettivo è cambiato
    var curVal2 = extraSel2.value;
    extraSel2.innerHTML = "";
    var opt00 = document.createElement("option");
    opt00.value = ""; opt00.textContent = "86+";
    extraSel2.appendChild(opt00);
    for (var lv3 = 86; lv3 <= effectiveMax; lv3++) {
      var opt3 = document.createElement("option");
      opt3.value = lv3; opt3.textContent = lv3;
      extraSel2.appendChild(opt3);
    }
    if (curVal2 && parseInt(curVal2) <= effectiveMax) extraSel2.value = curVal2;
  }

  function refreshGateUI() {
    var container = document.getElementById("acdb-gate-ui");
    if (!container) return;
    GATE_ORDER.forEach(function(gate) {
      var sel = container.querySelector('[data-gate="' + gate + '"]');
      if (!sel) return;
      var locked = !isGateUnlocked(gate);
      sel.disabled = locked;
      sel.style.background = locked ? "#111" : "#1a1a3a";
      sel.style.color = locked ? "#555" : "#eee";
      if (locked && gateValues[gate]) {
        gateValues[gate] = 0;
        sel.value = "0";
      }
    });

    // Mostra/nascondi spirit gear
    var sgContainer = document.getElementById("acdb-spirit-ui");
    if (sgContainer) {
      var prideMax = getMaxGateLevel("pride");
      var prideLevel = gateValues["pride"] || 0;
      sgContainer.style.display = (prideLevel >= prideMax && prideMax > 0) ? "block" : "none";
    }

    // Mostra/nascondi secondo memento
    var memo2Container = document.getElementById("acdb-memo2-ui");
    if (memo2Container) {
      var greedMax = getMaxGateLevel("greed");
      var greedLevel = gateValues["greed"] || 0;
      memo2Container.style.display = (greedLevel >= greedMax && greedMax > 0) ? "block" : "none";
    }
  }

  // ── SPIRIT GEAR UI ────────────────────────────────────────────────────────
  function buildSpiritGearUI() {
    if (!unitData || !unitData.spirit_gear || !unitData.spirit_gear.length) return "";
    var maxLevel = unitData.spirit_gear.length;
    var html = '<div id="acdb-spirit-ui" style="margin-top:8px;display:none">';
    html += '<div class="planner-header" style="font-size:0.75em">Spirit Gear</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.82em">';
    html += '<span style="opacity:0.7">Level</span>';
    html += '<select id="acdb-spirit-select" style="flex:1;background:#1a1a3a;color:#eee;border:1px solid #444;border-radius:3px;padding:2px">';
    html += '<option value="0">None</option>';
    for (var i = 1; i <= maxLevel; i++) {
      html += '<option value="' + i + '">' + i + '</option>';
    }
    html += '</select></div></div>';
    return html;
  }

  // ── GEAR/MEMO SELECTORS ───────────────────────────────────────────────────
  function buildGearSelector() {
    if (!unitData || !unitData.recommended_gear || !unitData.recommended_gear.length) return "";
    var html = '<div style="margin-top:8px"><div class="planner-header" style="font-size:0.75em">Gear</div>';
    for (var i = 0; i < 3; i++) {
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:0.82em">';
      html += '<span style="opacity:0.5;min-width:14px">' + (i+1) + '</span>';
      html += '<div id="acdb-gear-icon-' + i + '" style="width:28px;height:28px;flex-shrink:0;border-radius:3px;display:none;overflow:hidden">' +
              '<img style="width:100%;height:100%;object-fit:contain"></div>';
      html += '<select class="acdb-gear-select" data-slot="' + i + '" style="flex:1;background:#1a1a3a;color:#eee;border:1px solid #444;border-radius:3px;padding:2px">';
      html += '<option value="">None</option>';
      unitData.recommended_gear.forEach(function(g) {
        var statStr = g.stats ? " — " + decodeHtml(g.stats) : "";
        html += '<option value="' + g.href.split('/').pop().replace('.html','') + '">' + decodeHtml(g.name) + statStr + '</option>';
      });
      html += '</select></div>';
    }
    html += '</div>';
    return html;
  }

  function buildMemoSelector(id, label) {
    if (!unitData || !unitData.recommended_mementos || !unitData.recommended_mementos.length) return "";
    var memoIdx = id === "acdb-memo1-ui" ? 0 : 1;
    var html = '<div id="' + id + '" style="margin-top:6px">';
    html += '<div class="planner-header" style="font-size:0.75em">' + label + '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.82em">';
    html += '<div id="acdb-memo-icon-' + memoIdx + '" style="width:28px;height:28px;flex-shrink:0;border-radius:3px;display:none;overflow:hidden">' +
            '<img style="width:100%;height:100%;object-fit:contain"></div>';
    html += '<select class="acdb-memo-select" data-memo-id="' + id + '" style="flex:1;background:#1a1a3a;color:#eee;border:1px solid #444;border-radius:3px;padding:2px">';
    html += '<option value="">None</option>';
    unitData.recommended_mementos.forEach(function(m) {
      html += '<option value="' + m.href.split('/').pop().replace('.html','') + '">' + decodeHtml(m.name) + '</option>';
    });
    html += '</select></div></div>';
    return html;
  }

  // ── PASSIVE PANEL ─────────────────────────────────────────────────────────
  var selectedPassives = {};  // {"unit": [idx1, idx2]}

  function buildPassiveUI(job, gateUpgrades) {
    // Usa all_passives — lista unica di tutte le passive del personaggio
    if (!unitData || !unitData.all_passives || !unitData.all_passives.length) return "";

    var passives = unitData.all_passives;
    var jobKey = "unit";
    if (!selectedPassives[jobKey]) selectedPassives[jobKey] = [];
    var sel = selectedPassives[jobKey];

    // Costruisci mappa old_name → new skill dai gate attivi
    var replacements = {};
    if (gateUpgrades) {
      Object.keys(gateUpgrades).forEach(function(gate) {
        if (!isGateUnlocked(gate)) return;
        var maxLv2 = getMaxGateLevel(gate);
        if ((gateValues[gate] || 0) < maxLv2) return;
        gateUpgrades[gate].forEach(function(u) {
          if (u.old_name && u.new) replacements[u.old_name] = u.new;
        });
      });
    }

    var html = '<div style="margin-top:8px">';
    html += '<div class="planner-header" style="font-size:0.75em">Passives</div>';
    html += '<div style="font-size:0.72em;opacity:0.5;margin-bottom:4px">Attive: ' + sel.length + '/2</div>';

    passives.forEach(function(p, i) {
      var upgraded = replacements[p.name];
      var skill = upgraded || p;
      var isSelected = sel.indexOf(i) !== -1;
      var isUpgraded = !!upgraded;
      var desc = decodeHtml(skill.desc || "");

      html += '<div style="font-size:0.78em;margin-bottom:5px;padding:5px 8px;border-radius:4px;' +
              'border:1px solid ' + (isSelected ? 'rgba(68,170,255,0.4)' : 'rgba(255,255,255,0.08)') + ';' +
              'background:' + (isSelected ? 'rgba(68,170,255,0.08)' : 'rgba(255,255,255,0.02)') + '">';
      html += '<div style="display:flex;align-items:flex-start;gap:6px">';
      html += '<div style="flex:1">';
      html += '<div style="font-weight:500;' + (isUpgraded ? 'color:#aef' : '') + '">' +
              decodeHtml(skill.name) + (isUpgraded ? ' <span style="font-size:0.7em;opacity:0.7">[↑]</span>' : '') + '</div>';
      html += '<div style="opacity:0.55;font-size:0.9em;margin-top:1px">' + desc + '</div>';
      html += '</div>';
      var btnStyle = isSelected
        ? 'background:#1a5a8a;color:#7cf;border:1px solid #4af;padding:2px 8px;border-radius:3px;font-size:0.75em;cursor:pointer;flex-shrink:0;white-space:nowrap'
        : 'background:#2a2a3a;color:#aaa;border:1px solid #444;padding:2px 8px;border-radius:3px;font-size:0.75em;cursor:pointer;flex-shrink:0;white-space:nowrap';
      html += '<button class="acdb-passive-btn" data-idx="' + i + '" data-job="' + jobKey + '" style="' + btnStyle + '">' +
              (isSelected ? '✓ On' : '+ Equip') + '</button>';
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  // ── RECOMMENDED SECTIONS ──────────────────────────────────────────────────
  function addRecSection(container, title, items, imgBase, cssClass) {
    if (!items || !items.length) return;
    var old = container.querySelector("." + cssClass);
    if (old) old.remove();
    var wrap = mkEl("div", cssClass, "margin-top:6px");
    wrap.appendChild(mkEl("div","planner-header","font-size:0.75em",title));
    items.forEach(function(item) {
      var row = mkEl("div","","display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.8em");
      var img = mkEl("img","","width:28px;height:28px;border-radius:3px;flex-shrink:0");
      img.src = imgBase + item.img + ".png";
      img.onerror = function() { this.style.display = "none"; };
      row.appendChild(img);
      var info = mkEl("div");
      info.appendChild(mkLink(item.href, item.name));
      if (item.stats) {
        var s = mkEl("div","","opacity:0.55;font-size:0.78em");
        s.textContent = decodeHtml(item.stats);
        info.appendChild(s);
      }
      row.appendChild(info);
      wrap.appendChild(row);
    });
    container.appendChild(wrap);
  }

  // ── PANNELLO PRINCIPALE ───────────────────────────────────────────────────
  function buildAcdbPanel() {
    var unitInfo = document.getElementById("unitInfo");
    if (!unitInfo) return;
    var old = document.getElementById("acdb-main-panel");
    if (old) old.remove();

    var panel = document.createElement("div");
    panel.id = "acdb-main-panel";
    panel.style.cssText = "font-size:0.85em;border-top:1px solid rgba(255,255,255,0.1);margin-top:8px;padding-top:8px";

    // Leader skill
    if (unitData.leader_skill) {
      var ls = mkEl("div","acdb-ls","font-size:0.82em;margin-bottom:6px;padding:3px 6px;background:rgba(255,255,255,0.04);border-radius:3px");
      ls.appendChild(mkEl("span","","opacity:0.5;font-size:0.85em;margin-right:4px","Leader: "));
      ls.appendChild(mkLink(unitData.leader_skill.href, unitData.leader_skill.name));
      ls.appendChild(document.createTextNode(" \u2014 " + decodeHtml(unitData.leader_skill.desc)));
      panel.appendChild(ls);
    }

    // Master ability
    if (unitData.master_ability) {
      var ma = mkEl("div","acdb-ma","font-size:0.82em;margin-bottom:6px;padding:3px 6px;background:rgba(255,255,255,0.04);border-radius:3px");
      ma.appendChild(mkEl("span","","opacity:0.5;font-size:0.85em;margin-right:4px","Master: "));
      ma.appendChild(mkLink(unitData.master_ability.href, unitData.master_ability.name));
      var d2 = mkEl("div","","opacity:0.6;font-size:0.85em");
      d2.textContent = decodeHtml(unitData.master_ability.desc);
      ma.appendChild(d2);
      panel.appendChild(ma);
    }

    // Gate UI
    panel.insertAdjacentHTML("beforeend", buildGateUI());

    // Spirit gear UI
    panel.insertAdjacentHTML("beforeend", buildSpiritGearUI());

    // Gear selector
    panel.insertAdjacentHTML("beforeend", buildGearSelector());

    // Bottone Max All Gates
    var maxGateBtn = document.createElement("button");
    maxGateBtn.id = "acdb-maxgate-btn";
    maxGateBtn.textContent = "⚡ Max All Gates";
    maxGateBtn.style.cssText = "width:100%;margin:6px 0;padding:4px;background:#2a3a2a;color:#6f6;border:1px solid #4a4;border-radius:4px;cursor:pointer;font-size:0.8em";
    maxGateBtn.addEventListener("click", function() {
      GATE_ORDER.forEach(function(gate) {
        if (!unitData.gates || !unitData.gates[gate]) return;
        var maxLv = unitData.gates[gate].length;
        var sel = panel.querySelector("[data-gate='" + gate + "']");
        if (sel && isGateUnlocked(gate)) {
          gateValues[gate] = maxLv;
          sel.value = maxLv;
        }
      });
      refreshGateUI();
      refreshExtraLevelSelect();
      updatePassivePanel();
      updateStats();
    });
    panel.appendChild(maxGateBtn);

    // Memento 1
    panel.insertAdjacentHTML("beforeend", buildMemoSelector("acdb-memo1-ui", "Memento"));

    // Memento 2 (sbloccato con Greed max)
    panel.insertAdjacentHTML("beforeend", buildMemoSelector("acdb-memo2-ui", "Memento 2 (Greed Max)"));
    var m2 = panel.querySelector("#acdb-memo2-ui");
    if (m2) m2.style.display = "none";

    // Rune UI (6 slot)
    loadRuneData(function(rd) {
      if (!rd) return;
      var runeDiv = mkEl("div","","margin-top:6px");
      runeDiv.appendChild(mkEl("div","planner-header","font-size:0.75em","Truth Seals (Runes)"));

      for (var slot = 1; slot <= 6; slot++) {
        (function(sl) {
          var sinName = rd.slot_to_sin[String(sl)];
          var sinData = rd.sins[sinName];
          if (!sinData) return;

          var row = mkEl("div","","margin-bottom:6px;font-size:0.8em");

          // Header: sin name
          row.appendChild(mkEl("div","","opacity:0.7;margin-bottom:2px", sinName + " (slot " + sl + ")"));

          // Riga 1: bottoni rarità
          var rarRow = mkEl("div","","display:flex;align-items:center;gap:3px;margin-bottom:2px");
          rarRow.appendChild(mkEl("span","","opacity:0.5;min-width:24px","Rar:"));

          RARITY_ORDER.forEach(function(rar) {
            var variants = sinData[rar] || [];
            if (!variants.length) return;
            var rarBtn = document.createElement("button");
            rarBtn.className = "acdb-rune-rar-btn";
            rarBtn.dataset.runeSlot = sl;
            rarBtn.dataset.rarity = rar;
            rarBtn.textContent = rar.toUpperCase();
            rarBtn.style.cssText = "padding:1px 6px;border-radius:3px;font-size:0.75em;cursor:pointer;" +
              "background:#2a2a3a;color:#888;border:1px solid #444";
            rarRow.appendChild(rarBtn);
          });
          row.appendChild(rarRow);

          // Riga 2: bottoni variante stat (Off + ogni variante disponibile)
          var varRow = mkEl("div","","display:flex;align-items:center;gap:3px;flex-wrap:wrap;margin-bottom:2px");
          varRow.appendChild(mkEl("span","","opacity:0.5;min-width:24px","Stat:"));

          var offBtn = document.createElement("button");
          offBtn.className = "acdb-rune-stat-btn";
          offBtn.dataset.runeSlot = sl;
          offBtn.dataset.statKey = "";
          offBtn.textContent = "Off";
          offBtn.style.cssText = "padding:1px 6px;border-radius:3px;font-size:0.75em;cursor:pointer;" +
            "background:#1a4a1a;color:#6f6;border:1px solid #4a4";  // default On=Off (nessuna runa)
          varRow.appendChild(offBtn);
          // Bottoni varianti SSR (partendo da SSR per mostrare tutte le opzioni)
          // Usa le varianti SSR per i bottoni (mostrano la stat key)
          var varSource = sinData.ssr || sinData.sr || sinData.r || [];
          varSource.forEach(function(entry, idx) {
            // Ricava la stat key da entry.stats
            var statKey = Object.keys(entry.stats)[0] || "";
            var varBtn = document.createElement("button");
            varBtn.className = "acdb-rune-stat-btn";
            varBtn.dataset.runeSlot = sl;
            varBtn.dataset.statKey = statKey;  // usa stat key, non indice
            varBtn.textContent = entry.label.split(",")[0]; // es "PATK +100"
            varBtn.style.cssText = "padding:1px 6px;border-radius:3px;font-size:0.75em;cursor:pointer;" +
              "background:#2a2a3a;color:#aaa;border:1px solid #444";
            varRow.appendChild(varBtn);
          });
          row.appendChild(varRow);

          // Riga 3: selector set
          var setRow = mkEl("div","","display:flex;align-items:center;gap:3px");
          setRow.appendChild(mkEl("span","","opacity:0.5;min-width:24px","Set:"));
          var setSel = document.createElement("select");
          setSel.className = "acdb-rune-set";
          setSel.dataset.runeSlot = sl;
          setSel.style.cssText = "flex:1;background:#1a1a3a;color:#eee;border:1px solid #444;border-radius:3px;padding:1px;font-size:0.78em";
          Object.keys(rd.sets).forEach(function(slug) {
            var s = rd.sets[slug];
            var setStatKeys = Object.keys(s.stats||{});
            var setDesc = setStatKeys.length ? " [" + setStatKeys.map(function(k){
              var entry = s.stats[k];
              var v = typeof entry === "object" ? entry.val : entry;
              var pct = typeof entry === "object" ? entry.pct : false;
              return k + "+" + v + (pct?"%":"");
            }).join(",") + "]" : "";
            setSel.innerHTML += "<option value='" + slug + "'>" +
              s.name + " (" + s.n_seals + "x)" + setDesc + "</option>";
          });
          setRow.appendChild(setSel);
          row.appendChild(setRow);

          runeDiv.appendChild(row);

          // Stato corrente slot
          if (!selectedRunes[sl]) selectedRunes[sl] = {rarity: "ssr", statKey: "", set_slug: Object.keys(rd.sets)[0]};

          function updateRuneButtons() {
            var cur = selectedRunes[sl];
            // Rarità buttons
            row.querySelectorAll(".acdb-rune-rar-btn").forEach(function(b) {
              var active = b.dataset.rarity === cur.rarity;
              b.style.background = active ? "#1a3a5a" : "#2a2a3a";
              b.style.color = active ? "#7cf" : "#888";
              b.style.border = active ? "1px solid #4af" : "1px solid #444";
            });
            // Stat variant buttons
            row.querySelectorAll(".acdb-rune-stat-btn").forEach(function(b) {
              var active = b.dataset.statKey === cur.statKey;
              // Aggiorna label con valore della rarità corrente
              var rarData2 = sinData[cur.rarity || "ssr"] || sinData.ssr || [];
              var matchEntry = rarData2.find(function(e) {
                return Object.keys(e.stats)[0] === b.dataset.statKey;
              });
              if (matchEntry) b.textContent = matchEntry.label.split(",")[0];
              b.style.background = active ? "#1a4a1a" : "#2a2a3a";
              b.style.color = active ? "#6f6" : "#aaa";
              b.style.border = active ? "1px solid #4a4" : "1px solid #444";
            });
          }
          updateRuneButtons();

          // Event: rarità
          row.querySelectorAll(".acdb-rune-rar-btn").forEach(function(b) {
            b.addEventListener("click", function() {
              var s = parseInt(this.dataset.runeSlot);
              selectedRunes[s].rarity = this.dataset.rarity;
              updateRuneButtons();
              updateStats();
            });
          });

          // Event: variante stat
          row.querySelectorAll(".acdb-rune-stat-btn").forEach(function(b) {
            b.addEventListener("click", function() {
              var s = parseInt(this.dataset.runeSlot);
              var sk = this.dataset.statKey;
              if (sk === "") {
                // Off button
                selectedRunes[s].statKey = "";
              } else {
                selectedRunes[s].statKey = sk;
                if (!selectedRunes[s].rarity) selectedRunes[s].rarity = "ssr";
              }
              updateRuneButtons();
              updateStats();
            });
          });

          // Event: set
          setSel.addEventListener("change", function() {
            var s = parseInt(this.dataset.runeSlot);
            selectedRunes[s].set_slug = this.value;
            updateStats();
          });
        })(slot);
      }

      // Inserisci rune nel pannello centrale (sotto le passive)
      var jobSkillsEl = document.getElementById("jobSkills");
      if (jobSkillsEl) {
        var oldRuneDiv = document.getElementById("acdb-rune-section");
        if (oldRuneDiv) oldRuneDiv.remove();
        runeDiv.id = "acdb-rune-section";
        jobSkillsEl.parentNode.insertBefore(runeDiv, jobSkillsEl.nextSibling);
      } else {
        panel.insertBefore(runeDiv, panel.querySelector("[id='acdb-bond-select']") ?
          panel.querySelector("[id='acdb-bond-select']").closest("div") : null);
      }
    });

    // Enlightened Bond
    if (unitData.enlightened_bond && unitData.enlightened_bond.levels && unitData.enlightened_bond.levels.length > 0) {
      var bondMaxLevel = unitData.enlightened_bond.levels[unitData.enlightened_bond.levels.length - 1].level;
      var bondDiv = mkEl("div","","margin-top:6px");
      var bondHeader = mkEl("div","planner-header","font-size:0.75em","Enlightened Bond: " + (unitData.enlightened_bond.name || ""));
      bondDiv.appendChild(bondHeader);
      var bondRow = mkEl("div","","display:flex;align-items:center;gap:6px;font-size:0.82em");
      var bondLabel = mkEl("span","","opacity:0.7","Level");
      var bondSel = document.createElement("select");
      bondSel.id = "acdb-bond-select";
      bondSel.style.cssText = "flex:1;background:#1a1a3a;color:#eee;border:1px solid #444;border-radius:3px;padding:2px";
      bondSel.innerHTML = "<option value='0'>None</option>";
      for (var bl = 1; bl <= bondMaxLevel; bl++) {
        bondSel.innerHTML += "<option value='" + bl + "'>" + bl + "</option>";
      }
      bondSel.addEventListener("change", function() {
        bondLevel = parseInt(this.value) || 0;
        updateStats();
      });
      bondRow.appendChild(bondLabel);
      bondRow.appendChild(bondSel);
      bondDiv.appendChild(bondRow);
      panel.appendChild(bondDiv);
    }

    // Bonus HP fisso (solo JP)
    var isJP = locale === "jp" || window.location.href.indexOf("/jp/") >= 0;
    var hpDiv = mkEl("div","","margin-top:6px" + (isJP ? "" : ";display:none"));
    var hpHeader = mkEl("div","planner-header","font-size:0.75em","Bonus HP (fixed, max +10000)");
    hpDiv.appendChild(hpHeader);
    var hpRow = mkEl("div","","display:flex;align-items:center;gap:6px;font-size:0.82em");
    var hpInput = document.createElement("input");
    hpInput.type = "number";
    hpInput.min = "0";
    hpInput.max = "10000";
    hpInput.value = "0";
    hpInput.id = "acdb-hp-bonus";
    hpInput.style.cssText = "flex:1;background:#1a1a3a;color:#eee;border:1px solid #444;border-radius:3px;padding:2px 4px";
    hpInput.addEventListener("input", function() {
      bonusHP = Math.min(10000, Math.max(0, parseInt(this.value) || 0));
      updateStats();
    });
    hpRow.appendChild(mkEl("span","","opacity:0.7","HP +"));
    hpRow.appendChild(hpInput);
    hpDiv.appendChild(hpRow);
    panel.appendChild(hpDiv);

    // Stats panel
    // Stats nella colonna destra, dopo #unitStats
    var oldStatsDiv = document.getElementById("acdb-stats-wrapper");
    if (oldStatsDiv) oldStatsDiv.remove();
    var statsDiv = mkEl("div","","");
    statsDiv.id = "acdb-stats-wrapper";
    statsDiv.innerHTML = '<div class="planner-header">Total Stats (Base + Bonus)</div>' +
      '<table id="acdb-stats-panel" class="table table-sm stats-table"><tbody></tbody></table>';
    var unitStatsEl = document.getElementById("unitStats");
    if (unitStatsEl && unitStatsEl.parentNode) {
      unitStatsEl.parentNode.insertBefore(statsDiv, unitStatsEl.nextSibling);
    } else {
      panel.appendChild(statsDiv);
    }

    unitInfo.appendChild(panel);

    // ── EVENT LISTENERS ──────────────────────────────────────────────────────
    // Click bottone passive (event delegation sul container)
    unitInfo.addEventListener("click", function(e) {
      var btn = e.target.closest(".acdb-passive-btn");
      if (!btn) return;
      e.preventDefault();
      var idx = parseInt(btn.dataset.idx);
      var jobKey = btn.dataset.job;
      if (!selectedPassives[jobKey]) selectedPassives[jobKey] = [];
      var sel = selectedPassives[jobKey];
      var pos = sel.indexOf(idx);
      if (pos !== -1) {
        sel.splice(pos, 1);
      } else {
        if (sel.length >= 2) sel.shift();
        sel.push(idx);
      }
      updatePassivePanel();
      updateStats();
    });

    // Gate selects
    panel.querySelectorAll(".acdb-gate-select").forEach(function(sel) {
      sel.addEventListener("change", function() {
        gateValues[this.dataset.gate] = parseInt(this.value) || 0;
        refreshGateUI();
        updatePassivePanel();
        updateStats();
      });
    });

    // Spirit gear select
    var sgSel = panel.querySelector("#acdb-spirit-select");
    if (sgSel) {
      sgSel.addEventListener("change", function() {
        spiritGearLevel = parseInt(this.value) || 0;
        updateStats();
      });
    }

    // Gear selects
    panel.querySelectorAll(".acdb-gear-select").forEach(function(sel) {
      sel.addEventListener("change", function() {
        var slot = parseInt(this.dataset.slot);
        var slug = this.value;
        var iconDiv = document.getElementById("acdb-gear-icon-" + slot);
        if (!slug) {
          selectedGear[slot] = null;
          if (iconDiv) iconDiv.style.display = "none";
          var oldStatEl = document.getElementById("acdb-gear-stat-" + slot);
          if (oldStatEl) oldStatEl.textContent = "";
          updateStats(); return;
        }
        var gearItem = (unitData.recommended_gear || []).find(function(g) {
          return g.href.split("/").pop().replace(".html","") === slug;
        });
        if (iconDiv && gearItem) {
          iconDiv.style.display = "block";
          iconDiv.querySelector("img").src = "/cdn.alchemistcodedb.com/images/ArtiIcon/" + gearItem.img + ".png";
        }
        // Usa numeric_stats dal JSON unit — affidabili e sempre disponibili
        selectedGear[slot] = gearItem
          ? {slug:slug, stats: gearItem.numeric_stats || {}, numeric_stats: gearItem.numeric_stats || {}, name: gearItem.name}
          : {slug:slug, stats:{}, name:slug};
        // Mostra stat stringa sotto la select
        var statId = "acdb-gear-stat-" + slot;
        var statEl = document.getElementById(statId);
        if (!statEl) {
          statEl = document.createElement("div");
          statEl.id = statId;
          statEl.style.cssText = "font-size:0.72em;opacity:0.55;margin-top:1px;margin-bottom:3px;padding-left:4px";
          var selectEl = panel.querySelector(".acdb-gear-select[data-slot='" + slot + "']");
          if (selectEl && selectEl.parentNode)
            selectEl.parentNode.insertAdjacentElement("afterend", statEl);
        }
        statEl.textContent = (gearItem && gearItem.stats) ? decodeHtml(gearItem.stats) : "";
        updateStats();
      });
    });

    // Memento selects
    panel.querySelectorAll(".acdb-memo-select").forEach(function(sel) {
      sel.addEventListener("change", function() {
        var memoId = this.dataset.memoId;
        var memoIdx = memoId === "acdb-memo1-ui" ? 0 : 1;
        var slug = this.value;
        var iconDiv = document.getElementById("acdb-memo-icon-" + memoIdx);
        var memoItem = (unitData.recommended_mementos || []).find(function(m) {
          return m.href.split("/").pop().replace(".html","") === slug;
        });
        if (iconDiv) {
          if (slug && memoItem) {
            iconDiv.style.display = "block";
            iconDiv.querySelector("img").src = "/cdn.alchemistcodedb.com/images/ConceptCardIcon/" + memoItem.img + ".png";
          } else {
            iconDiv.style.display = "none";
          }
        }
        // Mostra stat del memento sotto la select
        var memoStatId = "acdb-memo-stat-" + memoIdx;
        var memoStatEl = document.getElementById(memoStatId);
        if (!memoStatEl) {
          memoStatEl = document.createElement("div");
          memoStatEl.id = memoStatId;
          memoStatEl.style.cssText = "font-size:0.72em;opacity:0.55;margin-top:1px;margin-bottom:3px;padding-left:4px";
          var memoSelectEl = panel.querySelector(".acdb-memo-select[data-memo-id='" + memoId + "']");
          if (memoSelectEl && memoSelectEl.parentNode)
            memoSelectEl.parentNode.insertAdjacentElement("afterend", memoStatEl);
        }
        memoStatEl.textContent = (slug && memoItem && memoItem.stats) ? decodeHtml(memoItem.stats) : "";

        if (!slug) {
          if (memoId === "acdb-memo1-ui") selectedCard = null;
          else selectedCard2 = null;
          updateStats(); return;
        }
        // Usa sempre numeric_stats dalla lista recommended (più completi)
        // La fetch API può avere dati parziali
        var memoData = {slug:slug, stats: memoItem ? (memoItem.numeric_stats || {}) : {},
                        numeric_stats: memoItem ? (memoItem.numeric_stats || {}) : {},
                        name: memoItem ? memoItem.name : slug};
        if (memoId === "acdb-memo1-ui") selectedCard = memoData;
        else selectedCard2 = memoData;
        updateStats();
        // Fetch API solo come fallback se non abbiamo numeric_stats
        if (!memoData.numeric_stats || !Object.keys(memoData.numeric_stats).length) {
          fetch("/get-card-stats?slug=" + slug + "&locale=" + locale)
            .then(function(r) { return r.json(); })
            .then(function(d) {
              if (d && d.stats && Object.keys(d.stats).length) {
                d.numeric_stats = d.stats;
                if (memoId === "acdb-memo1-ui") selectedCard = d;
                else selectedCard2 = d;
                updateStats();
              }
            }).catch(function() {});
        }
      });
    });

    updateStats();
  }

  // ── PASSIVE PANEL ─────────────────────────────────────────────────────────
  function updatePassivePanel() {
    if (!unitData) return;
    var old = document.getElementById("acdb-passive-panel");
    if (old) old.remove();
    var container = document.getElementById("jobSkills");
    if (!container) return;
    var panel = mkEl("div");
    panel.id = "acdb-passive-panel";
    panel.insertAdjacentHTML("beforeend", buildPassiveUI(null, unitData.gate_passive_upgrades));
    container.appendChild(panel);
  }

  // ── ENHANCE PLANNER ───────────────────────────────────────────────────────
  function enhancePlanner(u) {
    unitData = u;
    gateValues = {};
    selectedGear = [null, null, null];
    selectedCard = null;
    selectedCard2 = null;
    spiritGearLevel = 0;
    bondLevel = 0;
    bonusHP = 0;
    selectedRunes = {};
    // Rimuovi div stat gear/memo del personaggio precedente
    for (var _i = 0; _i < 3; _i++) {
      var _el = document.getElementById("acdb-gear-stat-" + _i);
      if (_el) _el.remove();
    }
    for (var _j = 0; _j < 2; _j++) {
      var _el2 = document.getElementById("acdb-memo-stat-" + _j);
      if (_el2) _el2.remove();
    }

    var plannerEl = document.getElementById("unitPlanner");
    if (plannerEl) locale = plannerEl.getAttribute("data-locale") || "en";

    function doEnhance() {
      // Aggiungi select separato per livelli oltre 85 (il controller originale blocca >85)
      var unitMaxLevel2 = unitData.max_level || 99;
      var oldExtraLvl = document.getElementById("acdb-level-extra");
      if (oldExtraLvl) oldExtraLvl.remove();
      if (unitMaxLevel2 > 85) {
        var lvlSel = document.getElementById("levelSelect");
        if (lvlSel && lvlSel.parentNode) {
          var extraSel = document.createElement("select");
          extraSel.id = "acdb-level-extra";
          extraSel.className = lvlSel.className;
          extraSel.style.cssText = "margin-left:4px;width:auto";
          var opt0 = document.createElement("option");
          opt0.value = ""; opt0.textContent = "86+";
          extraSel.appendChild(opt0);
          for (var lv2 = 86; lv2 <= unitMaxLevel2; lv2++) {
            var opt2 = document.createElement("option");
            opt2.value = lv2; opt2.textContent = lv2;
            extraSel.appendChild(opt2);
          }
          extraSel.addEventListener("change", function() {
            if (this.value) {
              // Non toccare levelSelect originale — il controller lo resetterebbe
              // Ricalcola direttamente con il nostro livello
              updateStats();
            }
          });
          lvlSel.insertAdjacentElement("afterend", extraSel);
        }
      }
      buildAcdbPanel();
      updatePassivePanel();

      // Nascondi vecchi elementi grafici del planner originale
      var toHide = ["gear", "cardEquipment", "runes", "unitStats", "unitCP", "unitOtherStats"];
      // In JP nascondi anche Phantom Memories (genealogy)
      var isJP2 = locale === "jp" || window.location.href.indexOf("/jp/") >= 0;
      if (isJP2) toHide.push("crystals");
      toHide.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = "none";
      });

      var levelSel = document.getElementById("levelSelect");
      if (levelSel) levelSel.addEventListener("change", updateStats);

      document.addEventListener("click", function(e) {
        if (e.target.closest("a.job-link")) {
          setTimeout(function() { updatePassivePanel(); updateStats(); }, 150);
        }
      });
    }

    var el = document.getElementById("unitOptions");
    if (el && !el.classList.contains("d-none")) {
      doEnhance();
      return;
    }

    var obs = new MutationObserver(function(m, observer) {
      var el2 = document.getElementById("unitOptions");
      if (el2 && !el2.classList.contains("d-none")) {
        observer.disconnect();
        doEnhance();
      }
    });
    obs.observe(document.body, {attributes: true, subtree: true, attributeFilter: ["class"]});
  }

  // ── INTERCETTA FETCH ──────────────────────────────────────────────────────
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    var result = origFetch.apply(this, arguments);
    if (typeof url === "string" && url.indexOf("/get-unit") !== -1) {
      result.then(function(resp) {
        resp.clone().json().then(enhancePlanner).catch(function(){});
      }).catch(function(){});
    }
    return result;
  };
})();
