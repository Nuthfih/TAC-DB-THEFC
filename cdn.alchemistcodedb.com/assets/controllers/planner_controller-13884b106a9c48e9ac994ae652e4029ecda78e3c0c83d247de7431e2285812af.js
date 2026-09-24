import { Controller } from "@hotwired/stimulus"
import { Modal } from "bootstrap"
import { get } from "@rails/request.js"
import "dexie"

var locale;
var gearList, cardList, runeList, expeditionList, crystalList, unitData;
var subM = [.10, .20, .25, .30, .40, .50];
var subC = [.10, .20, .30, .40, .50]
var crystalRanks = ["d", "c", "b", "a", "s"]
var crystalSet = [.50, .60, .70, .80, 1.00];
var crystalLevels = [60, 85, 91, 95, 99];
var unitLevel, unitJob, unitSkills, unitMA, unitEN, unitJM, unitJC, unitBonds, unitEXP, unitCJobs, unitC2Jobs;
var addStats, addJM, addEN, addMA, addSkills, addGear, addGA, addCard, addCardGS, addCA, addRune, addTE, addBond, addEXP, addCrystal, addLimit;
var subGear;
var scaleJM, scaleEN, scaleMA, scaleSkills, scaleGear, scaleGA, scaleCA, scaleBA, scaleRune, scaleTE, scaleBond, scaleEXP;
var addJMTK, addENTK, addMATK, addSkillsTK, addGearTK, addGATK, addCardTK, addCardGSTK, addCATK, addTETK, addBondTK, addEXPTK, addCrystalTK;
var addJMTK2, addENTK2, addMATK2, addSkillsTK2, addGearTK2, addGATK2, addCardTK2, addCardGSTK2, addCATK2, addTETK2, addBondTK2, addEXPTK2, addCrystalTK2;
var siteURL = [window.location.protocol, "//", window.location.host].join("");

export default class extends Controller {
  connect() {
    locale = document.body.getAttribute("data-locale");
    if(locale == "jp") {
      if(typeof(localStorage) && localStorage.getItem("unitSelectType") != null) {
        var unitSelectType = localStorage.getItem("unitSelectType");
        if(unitSelectType == 1) {
          var unitSlug = document.getElementById("unitSlug");
          unitSlug.setAttribute("data-slug", 1);
          var unitSelect = document.getElementById("unitsSelect");
          for (var i = 0; i < unitSelect.length; i++){
            var option = unitSelect.options[i];
            option.setAttribute("data-name", option.text);
            option.text = option.value.replace("-", " ");
          }
          Array.from(unitSelect.querySelectorAll("option")).sort(function(a, b) {
            return a.text < b.text ? 1 : -1;
          }).forEach(function(el2) {
            unitSelect.insertBefore(el2, unitSelect[0]);
          });
          if(window.location.search.indexOf("?build=") >= 0) {
            var parseJson = JSON.parse(atob(getParameter("build")));
            if(parseJson.hasOwnProperty("u") && unitSelect.querySelector("option[value='" + parseJson["u"] + "'") != null) {
              var unitSelect = document.getElementById("unitsSelect");
              unitSelect.value = parseJson["u"];
            }
          }
          else {
            unitSelect.selectedIndex = 0;
          }
        }
      }
    }
    const version = document.getElementById("unitPlanner").getAttribute("data-db-version-" + locale);
    const clientVersion = localStorage.getItem("db-version-" + locale);
    const db = new Dexie("ACDBDATA" + locale.toUpperCase());
    db.version(version).stores({
      Gear: "&id",
      Card: "&id",
      Rune: "&id",
      Expedition: "&id",
      Crystal: "&id"
    });
    db.open().catch("InvalidStateError", function (error) {
      alert(error.inner.name + ": " + error.inner.message + "\n\nIndexedDB usage is required to use the Unit Planner.");
    }).catch(Error, function(error) {
      alert(error.inner.name + ": " + error.inner.message + "\n\nCould not load data into IndexedDB.");
    }).then(function(data) {
      if(data != undefined) {
        setTables(db).then(function () {
          db.close();
          if(window.location.search.indexOf("?build=") >= 0) {
            resetElements();
            parseShareLink();
          }
        });
      }
      else {
        document.getElementById("unitsSelect").disabled = true;
      }
    });
    db.on("ready", function (db) {
      if(clientVersion != version) {
        document.getElementById("loading").classList.remove("d-none");
        document.getElementById("unitsSelect").disabled = true;
        localStorage.setItem("db-version-" + locale, version);
        return new Promise(function (resolve, reject) {
          const request = get("/get-gears", { responseKind: "json", query: { locale: locale } });
          request.then((response) => {
            if(response.ok) {
              resolve(response.json);
            }
          });
        }).then(function (data) {
          return db.Gear.bulkPut(data);
        }).then(function () {
          return new Promise(function (resolve, reject) {
            const request = get("/get-cards", { responseKind: "json", query: { locale: locale } });
            request.then((response) => {
              if(response.ok) {
                resolve(response.json);
              }
            })
          }).then(function (data) {
            return db.Card.bulkPut(data);
          })
        }).then(function () {
          return new Promise(function (resolve, reject) {
            const request = get("/get-runes", { responseKind: "json", query: { locale: locale } });
            request.then((response) => {
              if(response.ok) {
                resolve(response.json);
              }
            })
          }).then(function (data) {
            return db.Rune.bulkPut(data);
          })
        }).then(function () {
          return new Promise(function (resolve, reject) {
            const request = get("/get-expeditions", { responseKind: "json", query: { locale: locale } });
            request.then((response) => {
              if(response.ok) {
                resolve(response.json);
              }
            })
          }).then(function (data) {
            return db.Expedition.bulkPut(data);
          })
        }).then(function () {
          return new Promise(function (resolve, reject) {
            const request = get("/get-crystals", { responseKind: "json", query: { locale: locale } });
            request.then((response) => {
              if(response.ok) {
                resolve(response.json);
              }
            })
          }).then(function (data) {
            return db.Crystal.bulkPut(data);
          })
        }).then(function () {
          document.getElementById("loading").classList.add("d-none");
          document.getElementById("unitsSelect").disabled = false;
        });
      }
    });
    var runeStatsModal = document.getElementById("runeStatsModal");
    runeStatsModal.addEventListener("hide.bs.modal", updateRuneStats);
  }

  getUnit() {
    var unitSlug = document.getElementById("unitsSelect").value;
    if(unitSlug) {
      document.getElementById("loading").classList.remove("d-none");
      return new Promise(function (resolve, reject) {
        const request = get("/get-unit", { responseKind: "json", query: { slug: unitSlug, locale: locale } });
        request.then((response) => {
          if(response.ok) {
            resolve(response.json);
            document.getElementById("loading").classList.add("d-none");
          }
        });
      }).then(function (data) {
        unitData = data;
        resetUnit();
        buildUnit();
      });
    }
    else {
      resetUnit();
    }
  }

  levelSelect() {
    updateUnit(1);
  }

  toggleSlug(e) {
    var unitSelect = document.getElementById("unitsSelect");
    if(e.target.getAttribute("data-slug") == 0) {
      e.target.setAttribute("data-slug", 1);
      localStorage.setItem("unitSelectType", 1);
      for (var i = 0; i < unitSelect.length; i++) {
        var option = unitSelect.options[i];
        option.setAttribute("data-name", option.text);
        option.text = option.value.replace("-", " ");
      }
      Array.from(unitSelect.querySelectorAll("option")).sort(function(a, b) {
        return a.text < b.text ? 1 : -1;
      }).forEach(function(el2) {
        unitSelect.insertBefore(el2, unitSelect[0]);
      });
    }
    else {
      e.target.setAttribute("data-slug", 0);
      localStorage.removeItem("unitSelectType");
      for (var i = 0; i < unitSelect.length; i++){
        var option = unitSelect.options[i];
        option.text = option.getAttribute("data-name");
      }
    }
    if(window.location.search.indexOf("?build=") >= 0) {
      var parseJson = JSON.parse(atob(getParameter("build")));
      if(parseJson.hasOwnProperty("u") && unitSelect.querySelector("option[value='" + parseJson["u"] + "'") != null) {
        var unitSelect = document.getElementById("unitsSelect");
        unitSelect.value = parseJson["u"];
      }
    }
    else {
      unitSelect.selectedIndex = 0;
    }
  }

  gearList(e) {
    var el = document.getElementById("gear").getElementsByClassName("gear-icon");
    for (var i = 0; i < el.length; i++) {
      el[i].className = "gear-icon";
    }
    e.currentTarget.parentElement.className += " active";
    setGearList();
  }

  cardList(e) {
    var el = document.getElementById("cardEquipment").getElementsByClassName("card-icon");
    for (var i = 0; i < el.length; i++) {
      if(i == 0) {
        el[i].className = "card-icon";
      }
      else {
        el[i].className = "card-icon sub-card-icon";
        if(!document.getElementsByClassName("gate-6").length) {
          el[i].className += " d-none";
        }
      }
    }
    e.currentTarget.parentElement.className += " active";
    setCardList();
  }

  runeList(e) {
    var el = document.getElementById("runes").getElementsByClassName("rune-icon");
    for (var i = 0; i < el.length; i++) {
      el[i].className = "rune-icon";
    }
    e.currentTarget.parentElement.className += " active";
    setRuneList();
  }

  crystalList(e) {
    var el = document.getElementById("crystals").getElementsByClassName("crystal-icon");
    for (var i = 0; i < el.length; i++) {
      if(i == 0) {
        el[i].className = "crystal-icon";
      }
      else {
        el[i].className = "crystal-icon sub-crystal-icon";
        if(i == 3 && !document.getElementsByClassName("gate-3").length) {
          el[i].className += " d-none";
        }
        else if(i == 4 && !document.getElementsByClassName("gate-5").length) {
          el[i].className += " d-none";
        }
        else if(i == 5 && !document.getElementsByClassName("gate-7").length) {
          el[i].className += " d-none";
        }
      }
    }
    e.currentTarget.parentElement.className += " active";
    setCrystalList();
  }
}

async function getTableRows(db, table) {
  if(table == "Gear") {
    return db.Gear.toArray();
  }
  else if(table == "Card") {
    return db.Card.toArray();
  }
  else if(table == "Rune") {
    return db.Rune.toArray();
  }
  else if(table == "Expedition") {
    return db.Expedition.toArray();
  }
  else if(table == "Crystal") {
    return db.Crystal.toArray();
  }
}

async function setTables(db) {
  gearList = await getTableRows(db, "Gear");
  cardList = await getTableRows(db, "Card");
  runeList = await getTableRows(db, "Rune");
  expeditionList = await getTableRows(db, "Expedition");
  crystalList = await getTableRows(db, "Crystal");
}

function resetUnit() {
  resetElements();
  resetGear();

  var baseURL = [window.location.protocol, "//", window.location.host, window.location.pathname].join("");

  window.history.replaceState({}, "", baseURL);
  window.Turbo.navigator.history.replace({ href: baseURL });
}

function resetElements() {
  unitJob = unitSkills = unitMA = unitEN = unitJM = unitJC = unitBonds = unitEXP = undefined;
  unitCJobs = unitC2Jobs = Array(3).fill("");
  document.getElementById("levelSelect").disabled = true;
  document.getElementById("levelSelect").value = 85;
  document.getElementById("unitIcon").innerHTML = "";
  document.getElementById("unitJobs").innerHTML = "";
  document.getElementById("cp").innerHTML = 0;
  document.getElementById("hp").innerHTML = 0;
  document.getElementById("mp").innerHTML = 0;
  document.getElementById("atk").innerHTML = 0;
  document.getElementById("def").innerHTML = 0;
  document.getElementById("mag").innerHTML = 0;
  document.getElementById("mnd").innerHTML = 0;
  document.getElementById("dex").innerHTML = 0;
  document.getElementById("spd").innerHTML = 0;
  document.getElementById("cri").innerHTML = 0;
  document.getElementById("luk").innerHTML = 0;
  document.getElementById("imp").innerHTML = 0;
  document.getElementById("move").innerHTML = 0;
  document.getElementById("jmp").innerHTML = 0;
  document.getElementById("resistances").innerHTML = "";
  document.getElementById("otherStats").innerHTML = "";
  document.getElementById("jobSkills").innerHTML = "";
  document.getElementById("unitCP").className = "d-none";
  document.getElementById("unitStats").className = "d-none";
  document.getElementById("unitOtherStats").className = "d-none";
  document.getElementById("unitRes").className = "d-none";
  document.getElementById("unitOptions").className = "card main-panel d-none";
  document.getElementById("masterAbility").className = "d-none";
  document.getElementById("maSkill").innerHTML = "";
  document.getElementById("enlighten").className = "d-none";
  document.getElementById("enSkill").innerHTML = "";
  document.getElementById("genealogy").className = "d-none";
  document.getElementById("bondSkill").innerHTML = "";
  document.getElementById("spirit").className = "d-none";
  document.getElementById("spiritGear").innerHTML = "";
  document.getElementById("spiritGear").setAttribute("data-enhancement", 0);
  document.getElementById("babel").className = "d-none";
  document.getElementById("expSkill").innerHTML = "";
}

function resetGear() {
  var gears = document.getElementById("gear").querySelectorAll(".gear-icon");
  for(var g = 0; g < gears.length; g++) {
    if(gears[g].hasAttribute("data-gear-id")) {
      gears[g].removeAttribute("data-gear-id");
      gears[g].removeAttribute("data-type-id");
      gears[g].removeAttribute("data-rank-id");
      gears[g].removeAttribute("data-min-id");
      gears[g].className = "gear-icon";
      gears[g].innerHTML = "";
      var defaultIcon = document.createElement("div");
      defaultIcon.className = "icon empty-icon planner-icon";
      defaultIcon.setAttribute("data-bs-toggle", "modal");
      defaultIcon.setAttribute("data-bs-target", "#gearModal");
      defaultIcon.setAttribute("data-action", "click->planner#gearList");
      gears[g].appendChild(defaultIcon);
    }
  }

  var cards = document.getElementById("cardEquipment").querySelectorAll(".card-icon");
  for(var g = 0; g < cards.length; g++) {
    if(cards[g].hasAttribute("data-card-id")) {
      cards[g].removeAttribute("data-card-id");
      cards[g].removeAttribute("data-limit-break");
      cards[g].innerHTML = "";
      var defaultIcon = document.createElement("div");
      defaultIcon.className = "icon empty-icon planner-icon";
      defaultIcon.setAttribute("data-bs-toggle", "modal");
      defaultIcon.setAttribute("data-bs-target", "#cardModal");
      defaultIcon.setAttribute("data-action", "click->planner#cardList");
      if(g != 0) {
        cards[g].className = "card-icon sub-card-icon";
        if(!document.getElementsByClassName("gate-6").length) {
          cards[g].className += " d-none";
        }
      }
      else {
        cards[g].className = "card-icon";
      }
      cards[g].appendChild(defaultIcon);
    }
    else {
      if(g != 0) {
        cards[g].className = "card-icon sub-card-icon";
        if(!document.getElementsByClassName("gate-6").length) {
          cards[g].className += " d-none";
        }
      }
    }
  }

  var runes = document.getElementById("runes").querySelectorAll(".rune-icon");
  for(var g = 0; g < runes.length; g++) {
    if(runes[g].hasAttribute("data-rune-id")) {
      runes[g].removeAttribute("data-rune-id");
      runes[g].removeAttribute("data-set");
      runes[g].removeAttribute("data-enhancement");
      runes[g].removeAttribute("data-base-stat");
      runes[g].removeAttribute("data-evo-stat");
      runes[g].className = "rune-icon";
      runes[g].innerHTML = "";
      var defaultIcon = document.createElement("div");
      defaultIcon.className = "icon empty-icon planner-icon";
      defaultIcon.setAttribute("data-bs-toggle", "modal");
      defaultIcon.setAttribute("data-bs-target", "#runeModal");
      defaultIcon.setAttribute("data-action", "click->planner#runeList");
      var defaultSlot = document.createElement("div");
      defaultSlot.className = "slot slot-" + runes[g].getAttribute("data-slot");
      defaultIcon.appendChild(defaultSlot);
      
      runes[g].appendChild(defaultIcon);
    }
  }

  if(locale == "jp") {
    var crystals = document.getElementById("crystals").querySelectorAll(".crystal-icon");
    for(var g = 0; g < crystals.length; g++) {
      if(crystals[g].hasAttribute("data-crystal-id")) {
        crystals[g].removeAttribute("data-crystal-id");
        crystals[g].removeAttribute("data-rank-id");
        crystals[g].innerHTML = "";
        var defaultIcon = document.createElement("div");
        defaultIcon.className = "icon empty-icon planner-icon";
        defaultIcon.setAttribute("data-bs-toggle", "modal");
        defaultIcon.setAttribute("data-bs-target", "#crystalModal");
        defaultIcon.setAttribute("data-action", "click->planner#crystalList");
        if(g == 4) {
          crystals[g].className = "crystal-icon sub-crystal-icon";
          if(!document.getElementsByClassName("gate-3").length) {
            crystals[g].className += " d-none";
          }
        }
        else if(g == 5) {
          crystals[g].className = "crystal-icon sub-crystal-icon";
          if(!document.getElementsByClassName("gate-7").length) {
            crystals[g].className += " d-none";
          }
        }
        else {
          crystals[g].className = "crystal-icon";
        }
        crystals[g].appendChild(defaultIcon);
      }
      else {
        if(g == 4) {
          crystals[g].className = "crystal-icon sub-crystal-icon";
          if(!document.getElementsByClassName("gate-3").length) {
            crystals[g].className += " d-none";
          }
        }
        else if(g == 5) {
          crystals[g].className = "crystal-icon sub-crystal-icon";
          if(!document.getElementsByClassName("gate-7").length) {
            crystals[g].className += " d-none";
          }
        }
      }
    }
  }
}

function buildUnit() {
  setUnitInfo();
  updateUnit(0);
}

function setUnitInfo() {
  document.getElementById("levelSelect").disabled = false;
  document.getElementById("unitOptions").className = "card main-panel";
  document.getElementById("unitCP").className = "";
  document.getElementById("unitStats").className = "";
  document.getElementById("unitOtherStats").className = "";
  document.getElementById("unitRes").className = "";
  unitLevel = document.getElementById("levelSelect").value;
  var unitIcon = document.getElementById("unitIcon");
  var unitImg = document.createElement("img");
  unitImg.src = imgPath + "/images/Portraits/" + unitData.img + ".png";
  var unitElementStar = document.createElement("div");
  unitElementStar.className = "element-star star-5";
  var unitElement = document.createElement("div");
  if(unitData.hasOwnProperty("ele_plus")) {
    unitElement.className = "high-element-icon " + "element-" + unitData.elem;
  }
  else {
    unitElement.className = "element-icon " + "element-" + unitData.elem;
  }
  unitElementStar.appendChild(unitElement);
  unitIcon.innerHTML = "";
  unitIcon.appendChild(unitImg);
  unitIcon.appendChild(unitElementStar);

  var jobsArray = [];
  var baseJobsArray = [];
  var cJobsArray = Array(3).fill("");
  var c2JobsArray = Array(3).fill("");
  var c3JobsArray = Array(3).fill("");
  unitCJobs = Array(3).fill("");
  unitC2Jobs = Array(3).fill("");
  var jobsLength = unitData.jobsets_data.length;
  var baseJobsCount = 3;
  for(var i = 0; i < jobsLength; i++) {
    if(unitData.jobsets_data[i].hasOwnProperty("cjob")) {
      if(jobsLength == 2) {
        baseJobsCount = 2;
      }
      var cjob = unitData.jobsets_data[i].ejob;
      var j = 0;
      if(baseJobsArray.indexOf(cjob) != -1) {
        j = baseJobsArray.indexOf(cjob);
        cJobsArray[j] = cjob;
        c2JobsArray[j] = unitData.jobsets_data[i].job;
      }
      else if(c2JobsArray.indexOf(cjob) != -1) {
        j = c2JobsArray.indexOf(cjob) + baseJobsCount;
        c3JobsArray[c2JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
        unitCJobs[c2JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
      }
      else {
        for(var x = 0; x < jobsLength; x++) {
          if(unitData.jobsets_data[x].hasOwnProperty("ejob")) {
            if(unitData.jobsets_data[x].ejob == cjob) {
              j = x;
            }
          }
        }
        unitC2Jobs[c3JobsArray.indexOf(cjob)] = unitData.jobsets_data[j].job;
      }
      if(baseJobsCount == 2 && j >= 2 || baseJobsCount != 2 && j >= 3) {
        if (typeof unitJC == "undefined" || (typeof unitJC != "undefined" && unitJC[c3JobsArray.indexOf(cjob)] == 3)) {
          jobsArray[c3JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
        }
        if (typeof unitJC == "undefined" || (typeof unitJC != "undefined" && unitJC[c2JobsArray.indexOf(cjob)] == 2)) {
          jobsArray[c2JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
        }
      }
      else {
        if (typeof unitJC == "undefined" || (typeof unitJC != "undefined" && unitJC[j] == 1)) {
          jobsArray[j] = unitData.jobsets_data[i].job;
        }
      }
    }
    else {
      baseJobsArray.push(unitData.jobsets_data[i].job);
      jobsArray.push(unitData.jobsets_data[i].job);
    }
  }

  var jobsCount = jobsArray.length;
  var unitJobs = document.getElementById("unitJobs");
  var jobs = document.createElement("div");
  jobs.className = "jobs";
  
  for(var a = 0; a < jobsCount; a++) {
    for(var i = 0; i < jobsLength; i++) {
      if(jobsArray[a] == unitData.jobs_data[i].iname) {
        var job = document.createElement("div");
        job.className = "job"
        var jobLink = document.createElement("a");
        jobLink.href = "#";
        if(typeof unitJob == "undefined") {
          if(a == 0) {
            jobLink.className = "job-link active";
            unitJob = i;
          }
        }
        else if(unitJob >= jobsLength) {
          if(a == 0) {
            jobLink.className = "job-link active";
            unitJob = i;
          }
        }
        else {
          if(i == unitJob) {
            jobLink.className = "job-link active";
          }
          else {
            jobLink.className = "job-link";
          }
        }
        jobLink.setAttribute("data-job-id", i);
        jobLink.addEventListener("click", function(e) {
          e.preventDefault();
          var el = document.getElementsByClassName("job-link");
          for (var i = 0; i < el.length; i++) {
            el[i].className = "job-link";
          }
          this.className += " active";
          var jobIcon = this.querySelector(".big-job-icon");
          jobIcon.classList.add("master");
          var jmEl = document.getElementsByClassName("job-master");
          for (var i = 0; i < jmEl.length; i++) {
            if(jmEl[i].parentElement.previousElementSibling.classList.contains("active")) {
              jmEl[i].className = "job-master d-none";
              jmEl[i].querySelector(".fa-star").className = "fa-solid fa-star";
              jmEl[i].setAttribute("data-job-master", 1);
            }
            else {
              jmEl[i].className = "job-master";
            }
          }
          updateUnit(1);
        });
        var jobDiv = document.createElement("div");
        var jobImg = document.createElement("img");
        if(unitData.jobs_data[i].hasOwnProperty("ac2d")) {
          jobImg.src = imgPath + "/images/JobIconM/" + unitData.jobs_data[i].ac2d + ".png";
        }
        else {
          jobImg.src = imgPath + "/images/JobIconM/" + unitData.jobs_data[i].mdl + ".png";
        }
        jobDiv.appendChild(jobImg)
        var jobButtons = document.createElement("div");
        jobButtons.className = "job-buttons";
        var jobMaster = document.createElement("span");
        jobMaster.className = "job-master";
        jobMaster.title = "Toggle Job Master";
        var jobMasterIcon = document.createElement("i");
        if(typeof unitJM != "undefined") {
          jobMaster.setAttribute("data-job-master", unitJM[a]);
          if(unitJM[a] == 1) {
            jobDiv.className = "big-job-icon master";
            jobMasterIcon.className = "fa-solid fa-star";
          }
          else {
            jobDiv.className = "big-job-icon";
            jobMasterIcon.className = "fa-regular fa-star";
          }
        }
        else {
          jobDiv.className = "big-job-icon master";
          jobMaster.setAttribute("data-job-master", 1);
          jobMasterIcon.className = "fa-solid fa-star";
        }
        jobMaster.addEventListener("click", function(e) {
          e.preventDefault();
          var jobMasterStatus = this.getAttribute("data-job-master");
          if(jobMasterStatus == 1) {
            this.setAttribute("data-job-master", 0);
            var starIcon = this.querySelector(".fa-star");
            starIcon.className = "fa-regular fa-star";
            var jobIcon = this.parentElement.previousElementSibling.querySelector(".big-job-icon");
            jobIcon.classList.remove("master");
          }
          else {
            this.setAttribute("data-job-master", 1);
            var starIcon = this.querySelector(".fa-star");
            starIcon.className = "fa-solid fa-star";
            var jobIcon = this.parentElement.previousElementSibling.querySelector(".big-job-icon");
            jobIcon.classList.add("master");
          }
          updateUnit(7);
        });
        if(jobLink.classList.contains("active")) {
          jobMaster.className += " d-none"
        }
        jobMaster.appendChild(jobMasterIcon);
        jobButtons.appendChild(jobMaster);
        var jobChange = 0;
        if(unitData.jobsets_data[i].hasOwnProperty("cjob")) {
          if(cJobsArray[a] == unitData.jobsets_data[i].ejob) {
            jobChange = 1;
          }
          else if(c2JobsArray[a] == unitData.jobsets_data[i].ejob) {
            jobChange = 2;
          }
          else if(c3JobsArray[a] == unitData.jobsets_data[i].ejob) {
            jobChange = 3;
          }
        }
        if(jobChange != 0 || cJobsArray[a] != "") {
          var jobToggle = document.createElement("span");
          jobToggle.className = "job-change";
          jobToggle.title = "Toggle Job Change";
          if(typeof unitJC != "undefined") {
            if(unitJC[a] != 0) {
              jobToggle.setAttribute("data-job-change", unitJC[a]);
            }
            else {
              jobToggle.setAttribute("data-job-change", 0);
            }
          }
          else {
            jobToggle.setAttribute("data-job-change", jobChange);
          }
          jobToggle.setAttribute("data-job-change-id", a);
          var jobToggleIcon = document.createElement("i");
          jobToggleIcon.className = "fa-solid fa-retweet";
          jobToggle.appendChild(jobToggleIcon);
          jobToggle.addEventListener("click", function(e) {
            e.preventDefault();
            var jobChangeStatus = this.getAttribute("data-job-change");
            var jobChangeID = this.getAttribute("data-job-change-id");
            if(jobChangeStatus == 3) {
              this.setAttribute("data-job-change", 0);
            }
            else if(jobChangeStatus == 2 && unitC2Jobs[jobChangeID] != "") {
              this.setAttribute("data-job-change", 3);
            }
            else if(jobChangeStatus == 2 && unitC2Jobs[jobChangeID] == "") {
              this.setAttribute("data-job-change", 0);
            }
            else if(jobChangeStatus == 1 && unitCJobs[jobChangeID] != "") {
              this.setAttribute("data-job-change", 2);
            }
            else if(jobChangeStatus == 1 && unitCJobs[jobChangeID] == "") {
              this.setAttribute("data-job-change", 0);
            }
            else {
              this.setAttribute("data-job-change", 1);
            }
            updateUnit(8);
          });
          jobButtons.appendChild(jobToggle);
        }
        jobLink.appendChild(jobDiv);
        job.appendChild(jobLink);
        job.appendChild(jobButtons);
        jobs.appendChild(job);
        break;
      }
    }
  }

  unitJobs.innerHTML = "";
  unitJobs.appendChild(jobs);

  var jobSkills = document.getElementById("jobSkills");
  jobSkills.innerHTML = "";

  if(unitData.hasOwnProperty("tobira")) {
    document.getElementById("enlighten").className = "";
    var gatesCount = unitData.tobira.length;
    var enEl = document.getElementById("enSkill");
    var gates = document.createElement("div");
    gates.className = "gates";

    for(var a = 1; a < gatesCount; a++) {
      var gate = document.createElement("div");
      gate.className = "gate";
      var gateDiv = document.createElement("div");
      if(locale == "jp") {
        gateDiv.className = "gate-bg";
      }
      else {
        gateDiv.className = "gate-bg gate-bg-en";
      }
      gateDiv.className += " gate-" + a;

      var gateButtons = document.createElement("div");
      gateButtons.className = "gate-buttons";
      var minIcon = document.createElement("i");
      var minusIcon = document.createElement("i");
      var addIcon = document.createElement("i");
      var maxIcon = document.createElement("i");

      minIcon.className = "fa-solid fa-circle-chevron-left";
      minusIcon.className = "fa-solid fa-circle-minus";
      addIcon.className = "fa-solid fa-circle-plus";
      maxIcon.className = "fa-solid fa-circle-chevron-right";

      minIcon.title = "Disable Gate";
      minusIcon.title = "Decrease Gate Level";
      addIcon.title = "Increase Gate Level";
      maxIcon.title = "Max Gate";

      if(typeof unitEN != "undefined" && unitLevel >= 85) {
        gateDiv.setAttribute("data-gate-level", unitEN[a-1]);
        if(a == 1) {
          if(unitEN[a-1] == 0) {
            minIcon.className += " disabled";
            minusIcon.className += " disabled";
          }
          else if(unitEN[a-1] == 6) {
            addIcon.className += " disabled";
            maxIcon.className += " disabled";
          }
        }
        else if(a == 2) {
          if(unitEN[a-2] >= 3) {
            if(unitEN[a-1] == 0) {
              minIcon.className += " disabled";
              minusIcon.className += " disabled";
            }
            else if(unitEN[a-1] == 6) {
              addIcon.className += " disabled";
              maxIcon.className += " disabled";
            }
          }
          else {
            minIcon.className += " disabled";
            minusIcon.className += " disabled";
            addIcon.className += " disabled";
            maxIcon.className += " disabled";
          }
        }
        else if(a == 3) {
          if(unitEN[a-2] >= 3) {
            if(unitEN[a-1] == 0) {
              minIcon.className += " disabled";
              minusIcon.className += " disabled";
            }
            else if(unitEN[a-1] == 6) {
              addIcon.className += " disabled";
              maxIcon.className += " disabled";
            }
          }
          else {
            minIcon.className += " disabled";
            minusIcon.className += " disabled";
            addIcon.className += " disabled";
            maxIcon.className += " disabled";
          }
        }
        else if(a == 4) {
          if(unitEN[0] == 6 && unitEN[1] == 6 && unitEN[2] == 6) {
            if(unitEN[a-1] == 0) {
              minIcon.className += " disabled";
              minusIcon.className += " disabled";
            }
            else if(unitEN[a-1] == 6) {
              addIcon.className += " disabled";
              maxIcon.className += " disabled";
            }
          }
          else {
            minIcon.className += " disabled";
            minusIcon.className += " disabled";
            addIcon.className += " disabled";
            maxIcon.className += " disabled";
          }
        }
        else if(a == 5) {
          if(unitEN[a-2] >= 3) {
            if(unitEN[a-1] == 0) {
              minIcon.className += " disabled";
              minusIcon.className += " disabled";
            }
            else if(unitEN[a-1] == 6) {
              addIcon.className += " disabled";
              maxIcon.className += " disabled";
            }
          }
          else {
            minIcon.className += " disabled";
            minusIcon.className += " disabled";
            addIcon.className += " disabled";
            maxIcon.className += " disabled";
          }
        }
        else if(a == 6) {
          if(unitEN[a-2] >= 3) {
            if(unitEN[a-1] == 0) {
              minIcon.className += " disabled";
              minusIcon.className += " disabled";
            }
            else if(unitEN[a-1] == 6) {
              addIcon.className += " disabled";
              maxIcon.className += " disabled";
            }
          }
          else {
            minIcon.className += " disabled";
            minusIcon.className += " disabled";
            addIcon.className += " disabled";
            maxIcon.className += " disabled";
          }
        }
      }
      else {
        gateDiv.setAttribute("data-gate-level", 0);
        if(a == 1 && unitLevel >= 85) {
          minIcon.className += " disabled";
          minusIcon.className += " disabled";
        }
        else {
          minIcon.className += " disabled";
          minusIcon.className += " disabled";
          addIcon.className += " disabled";
          maxIcon.className += " disabled";
        }
      }

      minIcon.addEventListener("click", function(e) {
        e.preventDefault();
        var gateDiv = this.parentElement.parentElement.querySelector(".gate-bg");
        var gateLevel = gateDiv.getAttribute("data-gate-level");
        if(unitLevel >= 85) {
          if(gateLevel != 0) {
            gateDiv.setAttribute("data-gate-level", 0);
          }
          updateUnit(6);
        }
      });

      minusIcon.addEventListener("click", function(e) {
        e.preventDefault();
        var gateDiv = this.parentElement.parentElement.querySelector(".gate-bg");
        var gateLevel = gateDiv.getAttribute("data-gate-level");
        if(unitLevel >= 85) {
          if(gateLevel != 0) {
            gateDiv.setAttribute("data-gate-level", parseInt(gateLevel) - 1);
          }
          updateUnit(6);
        }
      });

      addIcon.addEventListener("click", function(e) {
        e.preventDefault();
        var gateDiv = this.parentElement.parentElement.querySelector(".gate-bg");
        var gateLevel = gateDiv.getAttribute("data-gate-level");
        if(unitLevel >= 85) {
          if(gateLevel != 6) {
            gateDiv.setAttribute("data-gate-level", parseInt(gateLevel) + 1);
          }
          if(!this.classList.contains("disabled") && parseInt(gateLevel) + 1 == 1) {
            var l = 0;
            var levelSelect = document.getElementById("levelSelect");
            while(l < 2) {
              var option = document.createElement("option");
              option.text = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
              option.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
              levelSelect.add(option);
              l++;
            }
            levelSelect.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value);
          }
          updateUnit(6);
        }
      });

      maxIcon.addEventListener("click", function(e) {
        e.preventDefault();
        var gateDiv = this.parentElement.parentElement.querySelector(".gate-bg");
        var gateLevel = gateDiv.getAttribute("data-gate-level");
        if(unitLevel >= 85) {
          if(gateLevel != 6) {
            gateDiv.setAttribute("data-gate-level", 6);
          }
          if(!this.classList.contains("disabled") && gateLevel == 0) {
            var l = 0;
            var levelSelect = document.getElementById("levelSelect");
            while(l < 2) {
              var option = document.createElement("option");
              option.text = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
              option.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
              levelSelect.add(option);
              l++;
            }
            levelSelect.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value);
          }
          updateUnit(6);
        }
      });

      gateButtons.appendChild(minIcon);
      gateButtons.appendChild(minusIcon);
      gateButtons.appendChild(addIcon);
      gateButtons.appendChild(maxIcon);

      gate.appendChild(gateDiv);
      gate.appendChild(gateButtons);

      gates.appendChild(gate);
    }

    var gateAll = document.createElement("div");
    gateAll.className = "form-check form-switch";
    var gateInput = document.createElement("input");
    gateInput.setAttribute("type", "checkbox");
    gateInput.className = "form-check-input";
    gateInput.id = "gateSwitch";
    gateInput.addEventListener("click", function(e) {
      var switchStatus = document.getElementById("gateSwitch").checked;
      var selectedGates = document.querySelectorAll(".gate-bg");
      if(switchStatus) {
        var l = 0;
        var k = 0;
        var levelSelect = document.getElementById("levelSelect");
        for(var a = 0; a < selectedGates.length; a++) {
          var gateLevel = selectedGates[a].getAttribute("data-gate-level");
          if(unitLevel >= 85) {
            if(gateLevel == 0) {
              l += 2;
            }
            selectedGates[a].setAttribute("data-gate-level", 6);
          }
        }
        while(k < l) {
          var option = document.createElement("option");
          option.text = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
          option.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
          levelSelect.add(option);
          k++;
        }
        levelSelect.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value);
      }
      else {
        for(var a = 0; a < selectedGates.length; a++) {
          if(unitLevel >= 85) {
            selectedGates[a].setAttribute("data-gate-level", 0);
          }
        }
      }
      updateUnit(6);
    });
    var gateLabel = document.createElement("label");
    gateLabel.className = "form-check-label";
    gateLabel.htmlFor = "gateSwitch";
    gateLabel.appendChild(document.createTextNode("Max All Gates"));
    gateAll.appendChild(gateInput);
    gateAll.appendChild(gateLabel);
    gates.appendChild(gateAll);

    enEl.appendChild(gates);
  }

  for(var a = 0; a < jobsCount; a++) {
    for(var i = 0; i < jobsLength; i++) {
      if(jobsArray[a] == unitData.jobs_data[i].iname) {
        for(var s = 2; s < 11; s++) {
          if(unitData.jobs_data[i].hasOwnProperty("learn_skill_" + s + "_data")) {
            var ability = eval("unitData.jobs_data[" + i + "].learn_skill_" + s + "_data");
            if(ability.slot == 1 && (!ability.skl1_data.hasOwnProperty("cond") || ability.hasOwnProperty("skl2_data") && !ability.skl2_data.hasOwnProperty("cond"))) {
              var skillDiv = document.createElement("div");
              skillDiv.className = "skill-details";
              var skillDetails = document.createElement("div");
              skillDetails.className = "skill-details-box d-flex";
              skillDetails.setAttribute("data-job-id", i);
              skillDetails.setAttribute("data-skill-id", s);
              skillDetails.setAttribute("data-skill", 0);
              var skillIcon = document.createElement("div");
              skillIcon.className = "ability-type-icon ability-type-1";
              var skillTextDiv = document.createElement("div");
              skillTextDiv.className = "flex-grow-1 align-self-center ms-2 text-start";
              var skillText = document.createTextNode(ability.skl1_data.name);

              skillDetails.addEventListener("click", function(e) {
                var skillStatus = this.getAttribute("data-skill");
                if(skillStatus == 0 && document.querySelectorAll(".skill-details .skill-details-box.selected").length < 2) {
                  this.className = "skill-details-box d-flex selected";
                  this.setAttribute("data-skill", 1);
                }
                else if(skillStatus == 1) {
                  this.className = "skill-details-box d-flex";
                  this.setAttribute("data-skill", 0);
                }
                updateUnit(2);
              });

              skillTextDiv.appendChild(skillText);
              skillDetails.appendChild(skillIcon);
              skillDetails.appendChild(skillTextDiv);
              skillDiv.appendChild(skillDetails);

              jobSkills.appendChild(skillDiv);
            }
          }
        }
      }
    }
  }

  if(typeof unitSkills != "undefined") {
    var selectedSkills = document.querySelectorAll(".skill-details .skill-details-box");
    for(var a = 0; a < selectedSkills.length; a++) {
      if(unitSkills[a] == 1) {
        selectedSkills[a].setAttribute("data-skill", 1);
        selectedSkills[a].className += " selected";
      }
    }
  }

  if(unitData.hasOwnProperty("ability_data")) {
    var skill = eval("unitData.ability_data.skl1_data");
    if(unitData.ability_data.slot == 1 && skill.timing == 1 && !skill.hasOwnProperty("cond") && ((skill.hasOwnProperty("t_buff_data") && !skill.t_buff_data.hasOwnProperty("vone1") && !skill.t_buff_data.hasOwnProperty("app_mct") || (skill.hasOwnProperty("s_buff_data") && !skill.s_buff_data.hasOwnProperty("vone1") && !skill.s_buff_data.hasOwnProperty("app_mct"))))) {
      document.getElementById("masterAbility").className = "";
      var maEl = document.getElementById("maSkill");
      var skillDiv = document.createElement("div");
      skillDiv.className = "ma-details";
      var skillDetails = document.createElement("div");
      skillDetails.className = "skill-details-box d-flex";
      skillDetails.setAttribute("data-skill", 0);
      var skillIcon = document.createElement("div");
      skillIcon.className = "ability-type-icon ability-type-3";
      var skillTextDiv = document.createElement("div");
      skillTextDiv.className = "flex-grow-1 align-self-center ms-2 text-start";
      var skillText = document.createTextNode(skill.name);

      skillDetails.addEventListener("click", function(e) {
        var skillStatus = this.getAttribute("data-skill");
        if(unitLevel >= 80) {
          if(skillStatus == 0) {
            this.className = "skill-details-box d-flex selected";
            this.setAttribute("data-skill", 1);
          }
          else if(skillStatus == 1) {
            this.className = "skill-details-box d-flex";
            this.setAttribute("data-skill", 0);
          }
          updateUnit(4);
        }
      });

      skillTextDiv.appendChild(skillText);
      skillDetails.appendChild(skillIcon);
      skillDetails.appendChild(skillTextDiv);
      skillDiv.appendChild(skillDetails);
      maEl.appendChild(skillDiv);
    }

    if(typeof unitMA != "undefined") {
      var selectedMA = document.querySelector(".ma-details .skill-details-box");
      if(unitMA == 1) {
        selectedMA.setAttribute("data-skill", 1);
        selectedMA.className += " selected";
      }
    }
  }

  if(unitData.hasOwnProperty("truth_equipment")) {
    document.getElementById("spirit").className = "";
    var spirit = document.getElementById("spiritGear");
    var enhancement = parseInt(spirit.getAttribute("data-enhancement"));
    spirit.innerHTML = "";
    var itemIcon = document.createElement("div");
    itemIcon.className = "icon planner-icon";
    var itemImg = document.createElement("img");
    itemImg.src = imgPath + "/images/TruthEquipmentIcon/" + unitData.truth_equipment.icon + ".png";
    itemIcon.appendChild(itemImg);

    var itemButtons = document.createElement("div");
    itemButtons.className = "item-buttons";

    spirit.appendChild(itemIcon);

    var enhanceSelect = document.createElement("select");
    enhanceSelect.id = "enhanceSelect";
    enhanceSelect.className = "form-select index-control form-select-sm";
    
    var option = document.createElement("option");
    option.value = 0;
    if(enhancement == 0) {
      option.selected = true;
    }
    enhanceSelect.appendChild(option);
    for (var i = 0; i < unitData.truth_equipment.lv_effects.length; i++) {
      var option = document.createElement("option");
      option.value = i+1;
      option.text = i+1;
      if(i+1 == enhancement) {
        option.selected = true
      }
      enhanceSelect.appendChild(option);
    }
    enhanceSelect.addEventListener("change", function(e) {
      var spiritDiv = this.parentElement.parentElement;
      spiritDiv.setAttribute("data-enhancement", this.value);
      updateUnit(13);
    });

    itemButtons.appendChild(document.createTextNode("Lvl: "));
    itemButtons.appendChild(enhanceSelect);
    spirit.appendChild(itemButtons);
  }

  if(unitData.hasOwnProperty("bond_groups")) {
    document.getElementById("genealogy").className = "";
    var bond = document.getElementById("bondSkill");
    for(var a = 0; a < unitData.bond_groups.length; a++) {
      var bondDetails = document.createElement("div");
      bondDetails.className = "bond-details-box";
      bondDetails.setAttribute("data-level", 0);
      var bondButtons = document.createElement("div");
      bondButtons.className = "bond-buttons";
      for(var i = 0; i < unitData.bond_groups[a].group_buff.buffs[0].unit_group.units.length; i++) {
        if(unitData.bond_groups[a].group_buff.buffs[0].unit_group.units[i].includes("_TRANS")) {
          continue;
        }
        var bondIcon = document.createElement("div");
        bondIcon.className = "unit-icon";
        var iconBG = document.createElement("div");
        iconBG.className = "icon small-icon"
        var bondImg = document.createElement("img");
        bondImg.src = imgPath + "/images/Portraits/" + unitData.bond_groups[a].group_buff.buffs[0].unit_group.units_data[i].img + ".png";
        bondImg.alt = unitData.bond_groups[a].group_buff.buffs[0].unit_group.units_data[i].name;
        iconBG.appendChild(bondImg);
        bondIcon.appendChild(iconBG);
        bondDetails.appendChild(bondIcon)
      }
      for(var i = 0; i < unitData.bond_groups[a].group_buff.buffs.length; i++) {
        var bondButton = document.createElement("div");
        bondButton.className = "bond-button-box";
        bondButton.setAttribute("data-active", 0);
        bondButton.appendChild(document.createTextNode("Lvl " + (i+1)));
        bondButton.addEventListener("click", function(e) {
          var bondStatus = this.getAttribute("data-active");
          var bondParent = this.parentNode;
          var bondBox = bondParent.parentNode;
          if(bondBox.className.split(/\s+/).indexOf("enabled") != -1) {
            var bondLvls = bondParent.querySelectorAll(".bond-button-box");
            for(var g = 0; g < bondLvls.length; g++) {
              bondLvls[g].className = "bond-button-box";
              bondLvls[g].setAttribute("data-active", 0);
              if(bondLvls[g] == this) {
                if(bondStatus == 0) {
                  this.className = "bond-button-box selected";
                  this.setAttribute("data-active", 1);
                  bondBox.setAttribute("data-level", g+1);
                }
                else if(bondStatus == 1) {
                  bondBox.setAttribute("data-level", 0);
                }
              }
            }
            updateUnit(14);
          }
        });
        bondButtons.appendChild(bondButton);
      }
      bondDetails.appendChild(bondButtons);
      bond.appendChild(bondDetails);
    }

    if(typeof unitBonds != "undefined") {
      var selectedBonds = document.querySelectorAll(".bond-details-box");
      for(var a = 0; a < selectedBonds.length; a++) {
        if(unitBonds[a] != 0) {
          selectedBonds[a].setAttribute("data-level", unitBonds[a]);
          var selectedBondButtons = selectedBonds[a].lastChild.getElementsByClassName("bond-button-box");
          for(i = 0; i < selectedBondButtons.length; i++) {
            if(i+1 == unitBonds[a]) {
              selectedBondButtons[i].className = "bond-button-box selected";
              selectedBondButtons[i].setAttribute("data-active", 1);
              break;
            }
          }
        }
      }
    }
  }

  if(expeditionList.length != 0) {
    document.getElementById("babel").className = "";
    var expSkill = document.getElementById("expSkill");
    var expeditions = document.createElement("div");
    expeditions.className = "expeditions";
    for(var a = 0; a < expeditionList.length; a++) {
      var expedition = document.createElement("div");
      expedition.className = "expedition";
      expedition.setAttribute("data-active", 0);
      var expBG = document.createElement("div");
      expBG.className = "expedition-bg expedition-" + expeditionList[a].data["ui_index"];
      expBG.title = areaTypes[expeditionList[a].data["ui_index"]];
      expedition.appendChild(expBG);
      expedition.addEventListener("click", function(e) {
        var expStatus = this.getAttribute("data-active");
        if(expStatus == 0) {
          this.className = "expedition selected";
          this.setAttribute("data-active", 1);
        }
        else if(expStatus == 1) {
          this.className = "expedition";
          this.setAttribute("data-active", 0);
        }
        var selectedEXP = document.querySelectorAll(".expedition");
        var expAll = true;
        for(var a = 0; a < selectedEXP.length; a++) {
          if(selectedEXP[a].getAttribute("data-active") == 0) {
            expAll = false;
            break;
          }
        }
        if(expAll) {
          document.getElementById("expSwitch").checked = true;
        }
        else {
          document.getElementById("expSwitch").checked = false;
        }
        updateUnit(15);
      });
      expeditions.appendChild(expedition);
    }
    var expAll = document.createElement("div");
    expAll.className = "form-check form-switch";
    var expInput = document.createElement("input");
    expInput.setAttribute("type", "checkbox");
    expInput.className = "form-check-input";
    expInput.id = "expSwitch";
    expInput.addEventListener("click", function(e) {
      var switchStatus = document.getElementById("expSwitch").checked;
      var expeditions = document.querySelectorAll(".expedition");
      if(switchStatus == true) {
        for(var a = 0; a < expeditions.length; a++) {
          expeditions[a].className = "expedition selected";
          expeditions[a].setAttribute("data-active", 1);
        }
      }
      else {
        for(var a = 0; a < expeditions.length; a++) {
          expeditions[a].className = "expedition";
          expeditions[a].setAttribute("data-active", 0);
        }
      }
      updateUnit(15);
    });
    var expLabel = document.createElement("label");
    expLabel.className = "form-check-label";
    expLabel.htmlFor = "expSwitch";
    expLabel.appendChild(document.createTextNode("Enable All"));
    expAll.appendChild(expInput);
    expAll.appendChild(expLabel);
    expeditions.appendChild(expAll);
    expSkill.appendChild(expeditions);

    if(typeof unitEXP != "undefined") {
      var selectedEXP = document.querySelectorAll(".expedition");
      var expAll = true;
      for(var a = 0; a < selectedEXP.length; a++) {
        if(unitEXP[a] != 0) {
          selectedEXP[a].className = "expedition selected";
          selectedEXP[a].setAttribute("data-active", unitEXP[a]);
        }
        else {
          expAll = false;
        }
      }
      if(expAll) {
        document.getElementById("expSwitch").checked = true;
      }
    }
  }

  buildShareLink();
}

function updateUnit(update_type) {
  unitLevel = document.getElementById("levelSelect").value;
  unitJob = document.querySelector("a.job-link.active").getAttribute("data-job-id");
  if(update_type == 8) {
    setJobChange();
    updateSkills();
  }
  if([0,1,7,8].indexOf(update_type) != -1) {
    setJobMaster();
  }
  if([0,1,6,8].indexOf(update_type) != -1) {
    setEnlightenment();
    updateLevelSelect();
  }
  if([0,1,4,8].indexOf(update_type) != -1) {
    setMasterAbility();
  }
  if([0,1,2,4,6,8].indexOf(update_type) != -1) {
    setSkills();
  }
  if([0,3].indexOf(update_type) != -1) {
    setGear();
  }
  if([0,1,3,8,9].indexOf(update_type) != -1) {
    updateGear();
  }
  if([0,5].indexOf(update_type) != -1) {
    setCard();
  }
  if([0,5,6,8,10].indexOf(update_type) != -1) {
    updateCard();
  }
  if([0,1,6,8].indexOf(update_type) != -1) {
    setBaseStats();
  }
  if([0,11].indexOf(update_type) != -1) {
    setRune();
  }
  if([0,11,12].indexOf(update_type) != -1) {
    updateRune();
  }
  if([0,1,6,8,13].indexOf(update_type) != -1) {
    setSpirit();
  }
  if([0,1,6,8,14].indexOf(update_type) != -1) {
    setBond();
  }
  if([0,15].indexOf(update_type) != -1) {
    setExpedition();
  }
  if([0,16].indexOf(update_type) != -1) {
    setCrystal();
  }
  if([0,1,6,8,16,17].indexOf(update_type) != -1) {
    updateCrystal();
  }
  updateStats();

  buildShareLink();
}

function setJobMaster() {
  var selectedJobs = document.querySelectorAll(".job-link");
  var selectedJobMaster = document.querySelectorAll(".job-master");
  addJM = Array(statTypes.length).fill(0);
  scaleJM = Array(statTypes.length).fill(0);

  addJMTK = Array(tokkouTypes.length).fill(0);
  addJMTK2 = Array(tokkouTypes.length).fill(0);

  for(var a = 0; a < selectedJobs.length; a++) {
    var jobID = selectedJobs[a].getAttribute("data-job-id");
    var jobMasterStatus = selectedJobMaster[a].getAttribute("data-job-master");

    if(jobMasterStatus == 1) {
      for(var b = 1; b < 12; b++) {
        var type = eval("unitData.jobs_data[" + jobID + "].master_data.t_buff_data.type" + b);
        if(type != undefined) {
          var calc = eval("unitData.jobs_data[" + jobID + "].master_data.t_buff_data.calc" + b);
          var val = eval("unitData.jobs_data[" + jobID + "].master_data.t_buff_data.vini" + b);
          if(calc == 0) {
            if(type == 48) {
              addJM[25] += val;
              addJM[26] += val;
              addJM[27] += val;
              addJM[28] += val;
              addJM[29] += val;
              addJM[30] += val;
              addJM[31] += val;
              addJM[32] += val;
              addJM[33] += val;
              addJM[34] += val;
              addJM[36] += val;
              addJM[37] += val;
              addJM[41] += val;
              addJM[42] += val;
              addJM[43] += val;
              addJM[45] += val;
              addJM[46] += val;
              addJM[105] += val;
            }
            else if(type == 78) {
              addJM[55] += val;
              addJM[56] += val;
              addJM[57] += val;
              addJM[58] += val;
              addJM[59] += val;
              addJM[60] += val;
              addJM[61] += val;
              addJM[62] += val;
              addJM[63] += val;
              addJM[64] += val;
              addJM[66] += val;
              addJM[67] += val;
              addJM[71] += val;
              addJM[73] += val;
              addJM[75] += val;
              addJM[76] += val;
              addJM[106] += val;
            }
            else if(type == 153) {
              var tokkou = tkTags.indexOf(eval("unitData.jobs_data[" + jobID + "].master_data.t_buff_data.tktag" + b));
              addJMTK[tokkou] += val;
            }
            else if(type == 190) {
              var tokkou = tkTags.indexOf(eval("unitData.jobs_data[" + jobID + "].master_data.t_buff_data.tktag" + b));
              addJMTK2[tokkou] += val;
            }
            else {
              addJM[type] += val;
            }
          }
          else if(calc == 1) {
            scaleJM[type] += val;
          }
        }
      }
    }
  }
}

function setEnlightenment() {
  addEN = Array(statTypes.length).fill(0);
  scaleEN = Array(statTypes.length).fill(0);

  addENTK = Array(tokkouTypes.length).fill(0);
  addENTK2 = Array(tokkouTypes.length).fill(0);
  if(unitData.hasOwnProperty("tobira")) {
    var selectedGates = document.querySelectorAll(".gate-bg");
    var selectedJobs = document.querySelectorAll(".job-link");

    var gate_two_flag = false;
    if(unitData.tobira.length > 2) {
      for(var a = 0; a < selectedJobs.length; a++) {
        var jobID = selectedJobs[a].getAttribute("data-job-id");
        var jobCondsCount = unitData.tobira[2].tobira_conds.conds_data[0].jobs_data.length;
        for(var j = 0; j < jobCondsCount; j++) {
          if(unitData.jobsets_data[jobID].job == unitData.tobira[2].tobira_conds.conds_data[0].jobs_data[j].iname) {
            gate_two_flag = true;
            break;
          }
        }
      }
    }

    var gateAllStatus = true;
    var gateSwitchStatus = true;

    for(var a = 0; a < selectedGates.length; a++) {
      var gateLevel = selectedGates[a].getAttribute("data-gate-level");
      var gateButtons = selectedGates[a].nextElementSibling;
      var minIcon = gateButtons.querySelector(".fa-circle-chevron-left");
      var minusIcon = gateButtons.querySelector(".fa-circle-minus");
      var addIcon = gateButtons.querySelector(".fa-circle-plus");
      var maxIcon = gateButtons.querySelector(".fa-circle-chevron-right");
      var subCardIcon = document.querySelector(".sub-card-icon");

      if(locale == "jp") {
        if(a == 2) {
          document.querySelector('.sub-crystal-icon[data-slot="4"]').classList.remove("d-none");
        }
        else if(a == 4) {
          document.querySelector('.sub-crystal-icon[data-slot="5"]').classList.remove("d-none");
        }
        else if(a == 6) {
          document.querySelector('.sub-crystal-icon[data-slot="6"]').classList.remove("d-none");
        }
      }

      if(unitLevel >= 85) {
        if(gateLevel != 6) {
          gateAllStatus = false;
        }
        if(a == 0) {
          if(gateLevel == 0) {
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.remove("disabled");
            maxIcon.classList.remove("disabled");
          }
          else if(gateLevel == 6) {
            minIcon.classList.remove("disabled");
            minusIcon.classList.remove("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
          }
          else {
            minIcon.classList.remove("disabled");
            minusIcon.classList.remove("disabled");
            addIcon.classList.remove("disabled");
            maxIcon.classList.remove("disabled");
          }
        }
        else if(a == 1) {
          var gate_req = selectedGates[a-1].getAttribute("data-gate-level");
          if(!gate_two_flag) {
            gateAllStatus = false;
            gateSwitchStatus = false;
          }
          if(gate_req >= 3 && gate_two_flag) {
            if(gateLevel == 0) {
              minIcon.classList.add("disabled");
              minusIcon.classList.add("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            else if(gateLevel == 6) {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.add("disabled");
              maxIcon.classList.add("disabled");
            }
            else {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
          }
          else {
            selectedGates[a].setAttribute("data-gate-level", 0);
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
          }
        }
        else if(a == 2) {
          var gate_req = selectedGates[a-1].getAttribute("data-gate-level");
          if(gate_req >= 3) {
            if(gateLevel == 0) {
              minIcon.classList.add("disabled");
              minusIcon.classList.add("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            else if(gateLevel == 6) {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.add("disabled");
              maxIcon.classList.add("disabled");
            }
            else {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
          }
          else {
            selectedGates[a].setAttribute("data-gate-level", 0);
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
          }
        }
        else if(a == 3) {
          var gate_req = selectedGates[a-1].getAttribute("data-gate-level");
          if(gate_req >= 3) {
            if(gateLevel == 0) {
              minIcon.classList.add("disabled");
              minusIcon.classList.add("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            else if(gateLevel == 6) {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.add("disabled");
              maxIcon.classList.add("disabled");
            }
            else {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
          }
          else {
            selectedGates[a].setAttribute("data-gate-level", 0);
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
          }
        }
        else if(a == 4) {
          var gate_req = selectedGates[a-1].getAttribute("data-gate-level");
          if(gate_req >= 3) {
            if(gateLevel == 0) {
              minIcon.classList.add("disabled");
              minusIcon.classList.add("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            else if(gateLevel == 6) {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.add("disabled");
              maxIcon.classList.add("disabled");
            }
            else {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
          }
          else {
            selectedGates[a].setAttribute("data-gate-level", 0);
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
          }
        }
        else if(a == 5) {
          var gate_req = selectedGates[a-1].getAttribute("data-gate-level");
          var sub_card = subCardIcon.querySelector(".locked-icon");
          subCardIcon.classList.remove("d-none");
          if(gate_req >= 3) {
            if(gateLevel == 0) {
              minIcon.classList.add("disabled");
              minusIcon.classList.add("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            else if(gateLevel == 6) {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.add("disabled");
              maxIcon.classList.add("disabled");
            }
            else {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            if(gateLevel == 6 && sub_card != null) {
              subCardIcon.innerHTML = "";
              var defaultIcon = document.createElement("div");
              defaultIcon.className = "icon empty-icon planner-icon";
              defaultIcon.setAttribute("data-bs-toggle", "modal");
              defaultIcon.setAttribute("data-bs-target", "#cardModal");
              defaultIcon.setAttribute("data-action", "click->planner#cardList");
              subCardIcon.appendChild(defaultIcon);
            }
            else if(gateLevel != 6 && sub_card == null) {
              subCardIcon.removeAttribute("data-card-id");
              subCardIcon.removeAttribute("data-limit-break");
              subCardIcon.innerHTML = "";
              var defaultIcon = document.createElement("div");
              defaultIcon.className = "icon empty-icon planner-icon";
              var lockedIcon = document.createElement("div");
              lockedIcon.className = "locked-icon";
              defaultIcon.appendChild(lockedIcon);
              subCardIcon.appendChild(defaultIcon);
            }
          }
          else {
            selectedGates[a].setAttribute("data-gate-level", 0);
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
            if(sub_card == null) {
              subCardIcon.removeAttribute("data-card-id");
              subCardIcon.removeAttribute("data-limit-break");
              subCardIcon.innerHTML = "";
              var defaultIcon = document.createElement("div");
              defaultIcon.className = "icon empty-icon planner-icon";
              var lockedIcon = document.createElement("div");
              lockedIcon.className = "locked-icon";
              defaultIcon.appendChild(lockedIcon);
              subCardIcon.appendChild(defaultIcon);
            }
          }
        }
        else if(a == 6) {
          var gate_req = selectedGates[a-1].getAttribute("data-gate-level");
          if(gate_req >= 3) {
            if(gateLevel == 0) {
              minIcon.classList.add("disabled");
              minusIcon.classList.add("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
            else if(gateLevel == 6) {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.add("disabled");
              maxIcon.classList.add("disabled");
            }
            else {
              minIcon.classList.remove("disabled");
              minusIcon.classList.remove("disabled");
              addIcon.classList.remove("disabled");
              maxIcon.classList.remove("disabled");
            }
          }
          else {
            selectedGates[a].setAttribute("data-gate-level", 0);
            minIcon.classList.add("disabled");
            minusIcon.classList.add("disabled");
            addIcon.classList.add("disabled");
            maxIcon.classList.add("disabled");
          }
        }
      }
      else {
        var sub_card = subCardIcon.querySelector(".locked-icon");
        selectedGates[a].setAttribute("data-gate-level", 0);
        minIcon.classList.add("disabled");
        minusIcon.classList.add("disabled");
        addIcon.classList.add("disabled");
        maxIcon.classList.add("disabled");
        if(sub_card == null) {
          subCardIcon.removeAttribute("data-card-id");
          subCardIcon.removeAttribute("data-limit-break");
          subCardIcon.innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          var lockedIcon = document.createElement("div");
          lockedIcon.className = "locked-icon";
          defaultIcon.appendChild(lockedIcon);
          subCardIcon.appendChild(defaultIcon);
        }
        gateAllStatus = false;
        gateSwitchStatus = false;
      }
    }

    var switchStatus = document.getElementById("gateSwitch");

    if(gateAllStatus) {
      switchStatus.checked = true;
    }
    else {
      switchStatus.checked = false;
    }
    if(gateSwitchStatus) {
      switchStatus.disabled = false;
    }
    else {
      switchStatus.disabled = true;
    }

    var selectedSkills = document.querySelectorAll(".skill-details .skill-details-box");

    for(var s = 1; s < unitData.tobira.length; s++) {
      var gateLevel = selectedGates[s-1].getAttribute("data-gate-level")-1;
      if(unitData.tobira[s].hasOwnProperty("skill") && gateLevel > 0) {
        for(var i = 1; i < 12; i++) {
          var type = eval("unitData.tobira[" + s + "].skill.t_buff_data.type" + i);
          if(type != undefined) {
            var value = 0;
            var min_value = eval("unitData.tobira[" + s + "].skill.t_buff_data.vini" + i);
            var max_value = eval("unitData.tobira[" + s + "].skill.t_buff_data.vmax" + i);
            var calc = eval("unitData.tobira[" + s + "].skill.t_buff_data.calc" + i);
            if(min_value == max_value) {
              value = min_value;
            }
            else if(gateLevel == 5) {
              value = max_value;
            }
            else {
              value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / 5)) * gateLevel / 100)
            }

            if(calc == 0) {
              if(type == 48) {
                addEN[25] += value;
                addEN[26] += value;
                addEN[27] += value;
                addEN[28] += value;
                addEN[29] += value;
                addEN[30] += value;
                addEN[31] += value;
                addEN[32] += value;
                addEN[33] += value;
                addEN[34] += value;
                addEN[36] += value;
                addEN[37] += value;
                addEN[41] += value;
                addEN[42] += value;
                addEN[43] += value;
                addEN[45] += value;
                addEN[46] += value;
                addEN[105] += value;
              }
              else if(type == 78) {
                addEN[55] += value;
                addEN[56] += value;
                addEN[57] += value;
                addEN[58] += value;
                addEN[59] += value;
                addEN[60] += value;
                addEN[61] += value;
                addEN[62] += value;
                addEN[63] += value;
                addEN[64] += value;
                addEN[66] += value;
                addEN[67] += value;
                addEN[71] += value;
                addEN[73] += value;
                addEN[75] += value;
                addEN[76] += value;
                addEN[106] += value;
              }
              else if(type == 153) {
                var tokkou = tkTags.indexOf(eval("unitData.tobira[" + s + "].skill.t_buff_data.tktag" + i));
                addENTK[tokkou] += value;
              }
              else if(type == 190) {
                var tokkou = tkTags.indexOf(eval("unitData.tobira[" + s + "].skill.t_buff_data.tktag" + i));
                addENTK2[tokkou] += value;
              }
              else {
                addEN[type] += value;
              }
            }
            else if(calc == 1) {
              scaleEN[type] += value;
            }

          }
        }
      }

      if(unitData.tobira[s].hasOwnProperty("learn_abils")) {
        for(var t = 0; t < unitData.tobira[s].learn_abils.length; t++) {
          if(unitData.tobira[s].learn_abils[t].add_type == 1) {
            for(var a = 0; a < selectedSkills.length; a++) {
              var jobID = selectedSkills[a].getAttribute("data-job-id");
              var skillID = selectedSkills[a].getAttribute("data-skill-id");

              var skill = eval("unitData.jobs_data[" + jobID + "].learn_skill_" + skillID + "_data");
              if(unitData.tobira[s].learn_abils[t].abil_overwrite.iname == skill.iname && gateLevel == 5) {
                var skillText = document.createTextNode(unitData.tobira[s].learn_abils[t].abil.skl1_data.name);
                selectedSkills[a].childNodes[0].className = "ability-type-icon ability-type-3";
                selectedSkills[a].childNodes[1].innerHTML = "";
                selectedSkills[a].childNodes[1].appendChild(skillText);
                break;
              }
              else if(unitData.tobira[s].learn_abils[t].abil_overwrite.iname == skill.iname) {
                var skillText = document.createTextNode(skill.skl1_data.name);
                selectedSkills[a].childNodes[0].className = "ability-type-icon ability-type-1";
                selectedSkills[a].childNodes[1].innerHTML = "";
                selectedSkills[a].childNodes[1].appendChild(skillText);
                break;
              }
            }
          }
          if(unitData.tobira[s].learn_abils[t].add_type == 2 && gateLevel == 5) {
            if(unitData.tobira[s].learn_abils[t].hasOwnProperty("abil")) {
              var skill = eval("unitData.tobira[" + s + "].learn_abils[" + t + "].abil.skl1_data");
              if(skill.hasOwnProperty("t_buff_data") && !skill.t_buff_data.hasOwnProperty("vone1") && !skill.t_buff_data.hasOwnProperty("app_mct")) {
                for(var i = 1; i < 12; i++) {
                  var type = eval("skill.t_buff_data.type" + i);
                  if(type != undefined) {
                    var calc = eval("skill.t_buff_data.calc" + i);
                    var value = eval("skill.t_buff_data.vini" + i);
                    if(calc == 0) {
                      if(type == 48) {
                        addEN[25] += value;
                        addEN[26] += value;
                        addEN[27] += value;
                        addEN[28] += value;
                        addEN[29] += value;
                        addEN[30] += value;
                        addEN[31] += value;
                        addEN[32] += value;
                        addEN[33] += value;
                        addEN[34] += value;
                        addEN[36] += value;
                        addEN[37] += value;
                        addEN[41] += value;
                        addEN[42] += value;
                        addEN[43] += value;
                        addEN[45] += value;
                        addEN[46] += value;
                        addEN[105] += value;
                      }
                      else if(type == 78) {
                        addEN[55] += value;
                        addEN[56] += value;
                        addEN[57] += value;
                        addEN[58] += value;
                        addEN[59] += value;
                        addEN[60] += value;
                        addEN[61] += value;
                        addEN[62] += value;
                        addEN[63] += value;
                        addEN[64] += value;
                        addEN[66] += value;
                        addEN[67] += value;
                        addEN[71] += value;
                        addEN[73] += value;
                        addEN[75] += value;
                        addEN[76] += value;
                        addEN[106] += value;
                      }
                      else if(type == 153) {
                        var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                        addENTK[tokkou] += value;
                      }
                      else if(type == 190) {
                        var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                        addENTK2[tokkou] += value;
                      }
                      else {
                        addEN[type] += value;
                      }
                    }
                    else if(calc == 1) {
                      scaleEN[type] += value;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

function updateLevelSelect() {
  if(unitData.hasOwnProperty("tobira")) {
    var levelIncrease = 0;
    var selectedGates = document.querySelectorAll(".gate-bg");
    for(var a = 0; a < selectedGates.length; a++) {
      var gateLevel = selectedGates[a].getAttribute("data-gate-level");
      if(gateLevel >= 1) {
        levelIncrease += 2;
      }
    }

    var maxLevel = 85 + levelIncrease;
    var levelSelect = document.getElementById("levelSelect");
    var currentLevel = document.getElementById("levelSelect").value;
    if(levelSelect.options[levelSelect.options.length - 1].value > maxLevel) {
      while(levelSelect.options[levelSelect.options.length - 1].value > maxLevel) {
        levelSelect.remove(levelSelect.length-1);
      }
      if(currentLevel > maxLevel) {
        levelSelect.value = maxLevel;
      }
    }
    else {
      while(levelSelect.options[levelSelect.options.length - 1].value < maxLevel) {
        var option = document.createElement("option");
        option.text = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
        option.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
        levelSelect.add(option);
      }
    }
  }
  else {
    var maxLevel = 85;
    var levelSelect = document.getElementById("levelSelect");
    var currentLevel = document.getElementById("levelSelect").value;
    while(levelSelect.options[levelSelect.options.length - 1].value > 85) {
      levelSelect.remove(levelSelect.length-1);
    }
    if(currentLevel > maxLevel) {
      levelSelect.value = 85;
    }
  }
  unitLevel = document.getElementById("levelSelect").value;

  if(locale == "jp") {
    for(a = 0; a < crystalLevels.length; a++) {
      if(unitLevel >= crystalLevels[a]) {
        var subCrystalIcon = document.querySelector('.sub-crystal-icon[data-slot="' + (a+2) + '"]');
        var lockedCrystal = document.querySelector('.sub-crystal-icon[data-slot="' + (a+2) + '"] .locked-icon');
        if(lockedCrystal != null) {
          subCrystalIcon.innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          defaultIcon.setAttribute("data-bs-toggle", "modal");
          defaultIcon.setAttribute("data-bs-target", "#crystalModal");
          defaultIcon.setAttribute("data-action", "click->planner#crystalList");
          subCrystalIcon.appendChild(defaultIcon);
        }
      }
      else {
        var subCrystalIcon = document.querySelector('.sub-crystal-icon[data-slot="' + (a+2) + '"]');
        var lockedCrystal = document.querySelector('.sub-crystal-icon[data-slot="' + (a+2) + '"] .locked-icon');
        if(lockedCrystal == null) {
          subCrystalIcon.removeAttribute("data-crystal-id");
          subCrystalIcon.removeAttribute("data-rank-id");
          subCrystalIcon.innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          var lockedIcon = document.createElement("div");
          lockedIcon.className = "locked-icon";
          defaultIcon.appendChild(lockedIcon);
          subCrystalIcon.appendChild(defaultIcon);
        }
      }
    }
  }
}

function setMasterAbility() {
  addMA = Array(statTypes.length).fill(0);
  scaleMA = Array(statTypes.length).fill(0);

  addMATK = Array(tokkouTypes.length).fill(0);
  addMATK2 = Array(tokkouTypes.length).fill(0);

  if(unitData.hasOwnProperty("ability_data")) {
    var skill = unitData.ability_data.skl1_data;
    var buffType = "";
    if(skill.timing == 1 && skill.hasOwnProperty("t_buff_data") && skill.t_buff_data.timing == 1 && !skill.t_buff_data.hasOwnProperty("vone1") && !skill.t_buff_data.hasOwnProperty("app_mct")) {
      buffType = "t_buff_data";
    }
    else if(skill.timing == 1 && skill.hasOwnProperty("s_buff_data") && skill.s_buff_data.timing == 1 && !skill.s_buff_data.hasOwnProperty("vone1") && !skill.s_buff_data.hasOwnProperty("app_mct")) {
      buffType = "s_buff_data";
    }
    if(buffType != "") {
      var selectedMasterAbility = document.querySelector(".ma-details .skill-details-box");
      if(selectedMasterAbility.getAttribute("data-skill") == 1 && unitLevel >= 80) {
        for(var i = 1; i < 12; i++) {
          var type = eval("skill." + buffType + ".type" + i);
          if(type != undefined) {
            var calc = eval("skill." + buffType + ".calc" + i);
            var val = eval("skill." + buffType + ".vini" + i);
            if(calc == 0) {
              if(type == 48) {
                addMA[25] += val;
                addMA[26] += val;
                addMA[27] += val;
                addMA[28] += val;
                addMA[29] += val;
                addMA[30] += val;
                addMA[31] += val;
                addMA[32] += val;
                addMA[33] += val;
                addMA[34] += val;
                addMA[36] += val;
                addMA[37] += val;
                addMA[41] += val;
                addMA[42] += val;
                addMA[43] += val;
                addMA[45] += val;
                addMA[46] += val;
                addMA[105] += val;
              }
              else if(type == 78) {
                addMA[55] += val;
                addMA[56] += val;
                addMA[57] += val;
                addMA[58] += val;
                addMA[59] += val;
                addMA[60] += val;
                addMA[61] += val;
                addMA[62] += val;
                addMA[63] += val;
                addMA[64] += val;
                addMA[66] += val;
                addMA[67] += val;
                addMA[71] += val;
                addMA[73] += val;
                addMA[75] += val;
                addMA[76] += val;
                addMA[106] += val;
              }
              else if(type == 153) {
                var tokkou = tkTags.indexOf(eval("skill." + buffType + ".tktag" + i));
                addMATK[tokkou] += val;
              }
              else if(type == 190) {
                var tokkou = tkTags.indexOf(eval("skill." + buffType + ".tktag" + i));
                addMATK2[tokkou] += val;
              }
              else {
                addMA[type] += val;
              }
            }
            else if(calc == 1) {
              scaleMA[type] += val;
            }
          }
        }
      }
      else {
        selectedMasterAbility.className = "skill-details-box d-flex";
        selectedMasterAbility.setAttribute("data-skill", 0);
      }
    }
    if(skill.hasOwnProperty("rp_tgt_ids")) {
      var selectedMasterAbility = document.querySelector(".ma-details .skill-details-box");
      if(selectedMasterAbility.getAttribute("data-skill") == 1 && unitLevel >= 80) {
        selectedMasterAbility.setAttribute("data-skill-change", 1);
      }
      else {
        selectedMasterAbility.setAttribute("data-skill-change", 0);
      }
    }
  }
}

function setJobChange() {
  var selectedJobChange = document.querySelectorAll(".job-buttons");
  var jobChange = Array(3).fill(0);
  for(var a = 0; a < jobChange.length; a++) {
    var job = selectedJobChange[a].querySelector(".job-change");
    if(job != null) {
      jobChange[a] = job.getAttribute("data-job-change");
    }
  }
  unitJC = jobChange;

  var jobsArray = [];
  var baseJobsArray = [];
  var cJobsArray = Array(3).fill("");
  var c2JobsArray = Array(3).fill("");
  var c3JobsArray = Array(3).fill("");
  var jobsLength = unitData.jobsets_data.length;
  var baseJobsCount = 3;
  for(var i = 0; i < jobsLength; i++) {
    if(unitData.jobsets_data[i].hasOwnProperty("cjob")) {
      if(jobsArray.length == 2) {
        baseJobsCount = 2;
      }
      var cjob = unitData.jobsets_data[i].ejob;
      var j = 0;
      if(baseJobsArray.indexOf(cjob) != -1) {
        j = baseJobsArray.indexOf(cjob);
        cJobsArray[j] = cjob;
        c2JobsArray[j] = unitData.jobsets_data[i].job;
      }
      else if(c2JobsArray.indexOf(cjob) != -1) {
        j = c2JobsArray.indexOf(cjob) + baseJobsCount;
        c3JobsArray[c2JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
      }
      else {
        j = c3JobsArray.indexOf(cjob) + baseJobsCount;
      }
      if(baseJobsCount == 2 && j >= 2 || baseJobsCount != 2 && j >= 3) {
        if (typeof unitJC == "undefined" || (typeof unitJC != "undefined" && unitJC[c3JobsArray.indexOf(cjob)] == 3)) {
          jobsArray[c3JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
        }
        else if (typeof unitJC == "undefined" || (typeof unitJC != "undefined" && unitJC[c2JobsArray.indexOf(cjob)] == 2)) {
          jobsArray[c2JobsArray.indexOf(cjob)] = unitData.jobsets_data[i].job;
        }
      }
      else {
        if (typeof unitJC == "undefined" || (typeof unitJC != "undefined" && unitJC[j] == 1)) {
          jobsArray[j] = unitData.jobsets_data[i].job;
        }
      }
    }
    else {
      baseJobsArray.push(unitData.jobsets_data[i].job);
      jobsArray.push(unitData.jobsets_data[i].job);
    }
  }

  var selectedJob = document.querySelectorAll(".job-link");

  for(var a = 0; a < jobsArray.length; a++) {
    for(var i = 0; i < jobsLength; i++) {
      if(jobsArray[a] == unitData.jobs_data[i].iname) {
        if(selectedJob[a].classList.contains("active")) {
          unitJob = i;
        }
        selectedJob[a].setAttribute("data-job-id", i);
        var jobImg = selectedJob[a].querySelector(".big-job-icon img");
        if(unitData.jobs_data[i].hasOwnProperty("ac2d")) {
          jobImg.src = imgPath + "/images/JobIconM/" + unitData.jobs_data[i].ac2d + ".png";
        }
        else {
          jobImg.src = imgPath + "/images/JobIconM/" + unitData.jobs_data[i].mdl + ".png";
        }
      }
    }
  }
}

function setSkills() {
  var selectedSkills = document.querySelectorAll(".skill-details .skill-details-box.selected");
  var skillChange = 0;
  if(unitData.hasOwnProperty("tobira") && unitData.tobira.length > 2) {
    var enActive = document.querySelector(".gate-2").getAttribute("data-gate-level");
  }
  if(unitData.hasOwnProperty("ability_data") && document.querySelector(".ma-details .skill-details-box") != null) {
    skillChange = document.querySelector(".ma-details .skill-details-box").getAttribute("data-skill-change");
  }

  addSkills = Array(statTypes.length).fill(0);
  scaleSkills = Array(statTypes.length).fill(0);

  addSkillsTK = Array(tokkouTypes.length).fill(0);
  addSkillsTK2 = Array(tokkouTypes.length).fill(0);

  for(var a = 0; a < selectedSkills.length; a++) {
    var jobID = selectedSkills[a].getAttribute("data-job-id");
    var skillID = selectedSkills[a].getAttribute("data-skill-id");

    var ability = eval("unitData.jobs_data[" + jobID + "].learn_skill_" + skillID + "_data");
    var abilityCount = 1;
    if(ability.hasOwnProperty("skl2_data")) {
      for(var i = 2; i < 11; i++) {
        if(ability.hasOwnProperty("skl" + i + "_data")) {
          abilityCount += 1;
        }
        else {
          break;
        }
      }
    }

    for(var s = 0; s < abilityCount; s++) {
      var skill = eval("ability.skl" + (s+1) +"_data");
      if(unitData.hasOwnProperty("tobira") && unitData.tobira.length > 2 && enActive == 6) {
        for(var i = 0; i < unitData.tobira.length; i++) {
          if(unitData.tobira[i].hasOwnProperty("learn_abils")) {
            for(var t = 0; t < unitData.tobira[i].learn_abils.length; t++) {
              if(unitData.tobira[i].learn_abils[t].add_type == 1 && unitData.tobira[i].learn_abils[t].abil_overwrite.iname == ability.iname) {
                skill = eval("unitData.tobira[" + i + "].learn_abils[" + t + "].abil.skl" + (s+1) +"_data");
                break;
              }
            }
          }
        }
      }
      if(unitData.hasOwnProperty("ability_data") && skillChange == 1) {
        maSkill = unitData.ability_data.skl1_data;
        for(var i = 0; i < maSkill.rp_tgt_ids_data.length; i++) {
          if(skill.iname == maSkill.rp_tgt_ids_data[i].iname) {
            skill = maSkill.rp_chg_ids_data[i];
            break;
          }
        }
      }
      if(skill.timing == 1 && skill.hasOwnProperty("t_buff_data") && !skill.t_buff_data.hasOwnProperty("vone1") && !skill.t_buff_data.hasOwnProperty("app_mct") && !skill.t_buff_data.hasOwnProperty("cond")) {
        for(var i = 1; i < 12; i++) {
          var type = eval("skill.t_buff_data.type" + i);
          if(type != undefined) {
            var calc = eval("skill.t_buff_data.calc" + i);
            var vmax = eval("skill.t_buff_data.vmax" + i);
            if(calc == 0) {
              if(type == 48) {
                addSkills[25] += vmax;
                addSkills[26] += vmax;
                addSkills[27] += vmax;
                addSkills[28] += vmax;
                addSkills[29] += vmax;
                addSkills[30] += vmax;
                addSkills[31] += vmax;
                addSkills[32] += vmax;
                addSkills[33] += vmax;
                addSkills[34] += vmax;
                addSkills[36] += vmax;
                addSkills[37] += vmax;
                addSkills[41] += vmax;
                addSkills[42] += vmax;
                addSkills[43] += vmax;
                addSkills[45] += vmax;
                addSkills[46] += vmax;
                addSkills[105] += vmax;
              }
              else if(type == 78) {
                addSkills[55] += vmax;
                addSkills[56] += vmax;
                addSkills[57] += vmax;
                addSkills[58] += vmax;
                addSkills[59] += vmax;
                addSkills[60] += vmax;
                addSkills[61] += vmax;
                addSkills[62] += vmax;
                addSkills[63] += vmax;
                addSkills[64] += vmax;
                addSkills[66] += vmax;
                addSkills[67] += vmax;
                addSkills[71] += vmax;
                addSkills[73] += vmax;
                addSkills[75] += vmax;
                addSkills[76] += vmax;
                addSkills[106] += vmax;
              }
              else if(type == 153) {
                var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                addSkillsTK[tokkou] += vmax;
              }
              else if(type == 190) {
                var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                addSkillsTK2[tokkou] += vmax;
              }
              else {
                addSkills[type] += vmax;
              }
            }
            else if(calc == 1) {
              scaleSkills[type] += vmax;
            }
          }
        }
      }
      else if(skill.timing == 1 && skill.hasOwnProperty("s_buff_data") && !skill.s_buff_data.hasOwnProperty("vone1") && !skill.s_buff_data.hasOwnProperty("app_mct") && !skill.s_buff_data.hasOwnProperty("cond")) {
        for(var i = 1; i < 12; i++) {
          var type = eval("skill.s_buff_data.type" + i);
          if(type != undefined) {
            var calc = eval("skill.s_buff_data.calc" + i);
            var vmax = eval("skill.s_buff_data.vmax" + i);
            if(calc == 0) {
              if(type == 48) {
                addSkills[25] += vmax;
                addSkills[26] += vmax;
                addSkills[27] += vmax;
                addSkills[28] += vmax;
                addSkills[29] += vmax;
                addSkills[30] += vmax;
                addSkills[31] += vmax;
                addSkills[32] += vmax;
                addSkills[33] += vmax;
                addSkills[34] += vmax;
                addSkills[36] += vmax;
                addSkills[37] += vmax;
                addSkills[41] += vmax;
                addSkills[42] += vmax;
                addSkills[43] += vmax;
                addSkills[45] += vmax;
                addSkills[46] += vmax;
                addSkills[105] += vmax;
              }
              else if(type == 78) {
                addSkills[55] += vmax;
                addSkills[56] += vmax;
                addSkills[57] += vmax;
                addSkills[58] += vmax;
                addSkills[59] += vmax;
                addSkills[60] += vmax;
                addSkills[61] += vmax;
                addSkills[62] += vmax;
                addSkills[63] += vmax;
                addSkills[64] += vmax;
                addSkills[66] += vmax;
                addSkills[67] += vmax;
                addSkills[71] += vmax;
                addSkills[73] += vmax;
                addSkills[75] += vmax;
                addSkills[76] += vmax;
                addSkills[106] += vmax;
              }
              else if(type == 153) {
                var tokkou = tkTags.indexOf(eval("skill.s_buff_data.tktag" + i));
                addSkillsTK[tokkou] += vmax;
              }
              else if(type == 190) {
                var tokkou = tkTags.indexOf(eval("skill.s_buff_data.tktag" + i));
                addSkillsTK2[tokkou] += vmax;
              }
              else {
                addSkills[type] += vmax;
              }
            }
            else if(calc == 1) {
              scaleSkills[type] += vmax;
            }
          }
        }
      }
    }
  }
}

function setGear() {
  var gears = document.getElementById("gear").querySelectorAll(".gear-icon");

  for(var g = 0; g < gears.length; g++) {
    if(gears[g].hasAttribute("data-gear-id")) {
      var gear = gears[g].getAttribute("data-gear-id");
      if(gearList[gear] != null)  {
        var cnd_flag = true;
        var sm_flag = false;
        if(gearList[gear].data.hasOwnProperty("cond_sm_data")) {
          var conds = gearList[gear].data.cond_sm_data.datas;
          cnd_flag = false;
          sm_flag = true;
          for(var a = 0; a < conds.length; a++) {
            if(conds[a].hasOwnProperty("unit_ids")) {
              cnd_flag = false;
              for(var b = 0; b < conds[a].unit_ids.length; b++) {
                if(unitData.iname == conds[a].unit_ids[b]) {
                  cnd_flag = true;
                  break;
                }
              }
            }
            if(conds[a].hasOwnProperty("job_ids")) {
              cnd_flag = false;
              for(var b = 0; b < conds[a].job_ids.length; b++) {
                if(unitData.jobsets_data[unitJob].iname == conds[a].job_ids[b]) {
                  cnd_flag = true;
                  break;
                }
              }
            }
            if(cnd_flag) {
              break;
            }
          }
        }
        if(!sm_flag || (sm_flag && !cnd_flag)) {
          cnd_flag = true;
          if(gearList[gear].data.hasOwnProperty("units")) {
            cnd_flag = false;
            for(var a = 0; a < gearList[gear].data.units.length; a++) {
              if(unitData.iname == gearList[gear].data.units[a]) {
                cnd_flag = true;
                break;
              }
            }
            if(!cnd_flag) {
              continue;
            }
          }
          if(gearList[gear].data.hasOwnProperty("jobs")) {
            cnd_flag = false;
            for(var a = 0; a < gearList[gear].data.jobs.length; a++) {
              if(unitData.jobs_data[unitJob].iname == gearList[gear].data.jobs[a] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == gearList[gear].data.jobs[a])) {
                cnd_flag = true;
                break;
              }
            }
            if(!cnd_flag) {
              continue;
            }
          }
          if(gearList[gear].data.hasOwnProperty("birth")) {
            if(gearList[gear].data.birth != unitData.birth) {
              cnd_flag = false;
              continue;
            }
          }
          if(gearList[gear].data.hasOwnProperty("sex")) {
            if(gearList[gear].data.sex != unitData.sex) {
              cnd_flag = false;
              continue;
            }
          }
          if(gearList[gear].data.hasOwnProperty("elem")) {
            if(gearList[gear].data.elem != unitData.elem) {
              cnd_flag = false;
              continue;
            }
          }
          if(gearList[gear].data.type == 1) {
            if(unitData.jobs_data[unitJob].hasOwnProperty("artifact_data") && unitData.jobs_data[unitJob].artifact_data.hasOwnProperty("tag")) {
              if(unitData.jobs_data[unitJob].artifact_data.tag != gearList[gear].data.tag) {
                cnd_flag = false;
                continue;
              }
            }
            else {
              cnd_flag = false;
              continue;
            }
          }
        }
        if(cnd_flag) {
          var gearRank = gears[g].getAttribute("data-rank-id");
          gears[g].innerHTML = "";
          gears[g].setAttribute("data-type-id", gearList[gear].data.type);
          gears[g].setAttribute("data-min-id", gearList[gear].data.rini+1);
          var gearIcon = document.createElement("div");
          gearIcon.className = "icon planner-icon icon-" + gearRank;
          gearIcon.setAttribute("data-bs-toggle", "modal");
          gearIcon.setAttribute("data-bs-target", "#gearModal");
          gearIcon.setAttribute("data-action", "click->planner#gearList");
          var gearImg = document.createElement("img");
          gearImg.src = imgPath + "/images/ArtiIcon/" + gearList[gear].data.icon + ".png";
          var gearType = document.createElement("div");
          gearType.className = "type type-" + gearList[gear].data.type;
          var gearStar = document.createElement("div");
          gearStar.className = "star-icon star-" + gearRank;

          gearType.appendChild(gearStar);
          gearIcon.appendChild(gearImg);
          gearIcon.appendChild(gearType);
          gears[g].appendChild(gearIcon);

          var gearButtons = document.createElement("div");
          gearButtons.className = "gear-buttons";

          if(gears[g].getAttribute("data-min-id") != 5) {
            var minusIcon = document.createElement("i");
            var addIcon = document.createElement("i");
            minusIcon.className = "fa-solid fa-circle-minus";
            if(gearRank == gears[g].getAttribute("data-min-id")) {
              minusIcon.className += " disabled";
            }
            addIcon.className = "fa-solid fa-circle-plus";
            if(gearRank == 5) {
              addIcon.className += " disabled";
            }
            minusIcon.title = "Decrease Gear Rank";
            addIcon.title = "Increase Gear Rank";

            minusIcon.addEventListener("click", function(e) {
              e.preventDefault();
              var gearDiv = this.parentElement.parentElement;
              var gearRank = gearDiv.getAttribute("data-rank-id");
              var minRank = gearDiv.getAttribute("data-min-id");
              if(gearRank != minRank) {
                gearDiv.setAttribute("data-rank-id", parseInt(gearRank) - 1);
                gearDiv.querySelector(".icon").classList.remove("icon-" + (gearRank));
                gearDiv.querySelector(".icon").classList.add("icon-" + (parseInt(gearRank) - 1));
                gearDiv.querySelector(".star-icon").classList.remove("star-" + (gearRank));
                gearDiv.querySelector(".star-icon").classList.add("star-" + (parseInt(gearRank) - 1));
                updateUnit(9);
              }
            });

            addIcon.addEventListener("click", function(e) {
              e.preventDefault();
              var gearDiv = this.parentElement.parentElement;
              var gearRank = gearDiv.getAttribute("data-rank-id");
              if(gearRank != 5) {
                gearDiv.setAttribute("data-rank-id", parseInt(gearRank) + 1);
                gearDiv.querySelector(".icon").classList.remove("icon-" + (gearRank));
                gearDiv.querySelector(".icon").classList.add("icon-" + (parseInt(gearRank) + 1));
                gearDiv.querySelector(".star-icon").classList.remove("star-" + (gearRank));
                gearDiv.querySelector(".star-icon").classList.add("star-" + (parseInt(gearRank) + 1));
                updateUnit(9);
              }
            });

            gearButtons.appendChild(minusIcon);
            gearButtons.appendChild(addIcon);
          }

          var closeIcon = document.createElement("i");
          closeIcon.className = "fa-solid fa-circle-xmark";
          closeIcon.title = "Remove Gear";

          closeIcon.addEventListener("click", function(e) {
            var gearDiv = this.parentElement.parentElement;
            gearDiv.removeAttribute("data-gear-id");
            gearDiv.removeAttribute("data-type-id");
            gearDiv.removeAttribute("data-min-id");
            gearDiv.removeAttribute("data-rank-id");
            gearDiv.innerHTML = "";
            var defaultIcon = document.createElement("div");
            defaultIcon.className = "icon empty-icon planner-icon";
            defaultIcon.setAttribute("data-bs-toggle", "modal");
            defaultIcon.setAttribute("data-bs-target", "#gearModal");
            defaultIcon.setAttribute("data-action", "click->planner#gearList");
            gearDiv.append(defaultIcon);
            updateUnit(3);
          });

          var infoLink = document.createElement("a");
          if(locale == "jp") {
            infoLink.href = siteURL + "/jp/gear/" + gearList[gear].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
          }
          else {
            infoLink.href = siteURL + "/gear/" + gearList[gear].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
          }
          infoLink.target = "_blank";
          var infoIcon = document.createElement("i");
          infoIcon.className = "fa-solid fa-circle-info";
          infoIcon.title = "View Gear Page";
          infoLink.appendChild(infoIcon);

          gearButtons.appendChild(closeIcon);
          gearButtons.appendChild(infoLink);

          gears[g].appendChild(gearButtons);
        }
        else {
          gears[g].removeAttribute("data-gear-id");
          gears[g].removeAttribute("data-type-id");
          gears[g].removeAttribute("data-min-id");
          gears[g].removeAttribute("data-rank-id");
          gears[g].innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          defaultIcon.setAttribute("data-bs-toggle", "modal");
          defaultIcon.setAttribute("data-bs-target", "#gearModal");
          defaultIcon.setAttribute("data-action", "click->planner#gearList");
          gears[g].appendChild(defaultIcon);
        }
      }
      else {
        gears[g].removeAttribute("data-gear-id");
        gears[g].removeAttribute("data-type-id");
        gears[g].removeAttribute("data-min-id");
        gears[g].removeAttribute("data-rank-id");
      }
    }
  }
}

function setCard() {
  var cards = document.getElementById("cardEquipment").querySelectorAll(".card-icon");

  for(var g = 0; g < cards.length; g++) {
    if(cards[g].hasAttribute("data-card-id")) {
      var card = cards[g].getAttribute("data-card-id");
      if(cardList[card] != null)  {
        var cardLB = cards[g].getAttribute("data-limit-break");
        cards[g].innerHTML = "";
        var cardIcon = document.createElement("div");
        cardIcon.className = "icon planner-icon icon-" + (cardList[card].data.rare+1);
        cardIcon.setAttribute("data-bs-toggle", "modal");
        cardIcon.setAttribute("data-bs-target", "#cardModal");
        cardIcon.setAttribute("data-action", "click->planner#cardList");
        var cardImg = document.createElement("img");
        cardImg.src = imgPath + "/images/ConceptCardIcon/" + cardList[card].data.icon + ".png";
        var cardStar = document.createElement("div");
        cardStar.className = "star-icon star-" + (cardList[card].data.rare+1);

        cardIcon.appendChild(cardImg);
        cardIcon.appendChild(cardStar);

        var cardButtons = document.createElement("div");
        cardButtons.className = "card-buttons";

        if(!cardList[card].data.hasOwnProperty("lvcap")) {
          var cardLimitBreak = document.createElement("div");
          if(cardLB == 5) {
            cardLimitBreak.className = "card-lb-icon card-lb-max";
          }
          else {
            cardLimitBreak.className = "card-lb-icon card-lb-" + cardLB;
          }
          cardIcon.appendChild(cardLimitBreak);
          var minusIcon = document.createElement("i");
          var addIcon = document.createElement("i");
          minusIcon.className = "fa-solid fa-circle-minus";
          if(cardLB == 0) {
            minusIcon.className += " disabled";
          }
          addIcon.className = "fa-solid fa-circle-plus";
          if(cardLB == 5) {
            addIcon.className += " disabled";
          }
          minusIcon.title = "Decrease Memento Limit Break";
          addIcon.title = "Increase Memento Limit Break";

          minusIcon.addEventListener("click", function(e) {
            e.preventDefault();
            var cardDiv = this.parentElement.parentElement;
            var cardLB = cardDiv.getAttribute("data-limit-break");
            if(cardLB != 0) {
              cardDiv.setAttribute("data-limit-break", parseInt(cardLB) - 1);
              var lbClass = cardLB;
              if(cardLB == 5) {
                lbClass = "max";
              }
              cardDiv.querySelector(".card-lb-icon").classList.remove("card-lb-" + (lbClass));
              cardDiv.querySelector(".card-lb-icon").classList.add("card-lb-" + (parseInt(cardLB) - 1));
              updateUnit(10);
            }
          });

          addIcon.addEventListener("click", function(e) {
            e.preventDefault();
            var cardDiv = this.parentElement.parentElement;
            var cardLB = cardDiv.getAttribute("data-limit-break");
            if(cardLB != 5) {
              cardDiv.setAttribute("data-limit-break", parseInt(cardLB) + 1);
              var lbClass = parseInt(cardLB) + 1;
              if((parseInt(cardLB) + 1) == 5) {
                lbClass = "max";
              }
              cardDiv.querySelector(".card-lb-icon").classList.remove("card-lb-" + (cardLB));
              cardDiv.querySelector(".card-lb-icon").classList.add("card-lb-" + lbClass);
              updateUnit(10);
            }
          });
          cardButtons.appendChild(minusIcon);
          cardButtons.appendChild(addIcon);
        }

        cards[g].appendChild(cardIcon);

        var closeIcon = document.createElement("i");
        closeIcon.className = "fa-solid fa-circle-xmark";
        closeIcon.title = "Remove Memento";

        closeIcon.addEventListener("click", function(e) {
          var cardDiv = this.parentElement.parentElement;
          cardDiv.removeAttribute("data-card-id");
          cardDiv.removeAttribute("data-limit-break");
          cardDiv.innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          defaultIcon.setAttribute("data-bs-toggle", "modal");
          defaultIcon.setAttribute("data-bs-target", "#cardModal");
          defaultIcon.setAttribute("data-action", "click->planner#cardList");
          cardDiv.append(defaultIcon);
          updateUnit(5);
        });

        var infoLink = document.createElement("a");
        if(locale == "jp") {
          infoLink.href = siteURL + "/jp/card/" + cardList[card].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
        }
        else {
          infoLink.href = siteURL + "/card/" + cardList[card].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
        }
        infoLink.target = "_blank";
        var infoIcon = document.createElement("i");
        infoIcon.className = "fa-solid fa-circle-info";
        infoIcon.title = "View Memento Page";
        infoLink.appendChild(infoIcon);

        cardButtons.appendChild(closeIcon);
        cardButtons.appendChild(infoLink);

        cards[g].appendChild(cardButtons);
      }
      else {
        cards[g].removeAttribute("data-card-id");
        cards[g].removeAttribute("data-limit-break");
      }
    }
  }
}

function setRune() {
  var runes = document.getElementById("runes").querySelectorAll(".rune-icon");

  for(var g = 0; g < runes.length; g++) {
    if(runes[g].hasAttribute("data-rune-id")) {
      var rune = runes[g].getAttribute("data-rune-id");
      if(runeList[rune] != null)  {
        var enhancement = parseInt(runes[g].getAttribute("data-enhancement"));
        runes[g].innerHTML = "";
        var runeIcon = document.createElement("div");
        runeIcon.className = "icon planner-icon icon-" + (runeList[rune].data.rarity+1);
        runeIcon.setAttribute("data-bs-toggle", "modal");
        runeIcon.setAttribute("data-bs-target", "#runeModal");
        var runeImg = document.createElement("img");
        runeImg.src = imgPath + "/images/ItemIcon/" + runeList[rune].data.icon + ".png";
        var runeSlot = document.createElement("div");
        runeSlot.className = "slot slot-" + runeList[rune].data.slot;
        var runeSet = document.createElement("div");
        runeSet.className = "set set-" + runeList[rune].data.seteff_type;
        var runeEvoAmt = parseInt((enhancement-1) / 3);
        var runeEnhanceAmt = 0;
        if(parseInt(enhancement) != 0) {
          if(parseInt(enhancement) % 3 == 0) {
            var runeEnhanceAmt = 3;
          }
          else {
            var runeEnhanceAmt = parseInt(enhancement) % 3;
          }
        }
        
        runeIcon.appendChild(runeImg);
        runeIcon.appendChild(runeSlot);
        runeIcon.appendChild(runeSet);

        var runeEvo = document.createElement("div");
        runeEvo.className = "evo evo-" + runeEvoAmt;
        runeIcon.appendChild(runeEvo);

        var runeEnhance = document.createElement("div");
        runeEnhance.className = "enhance enhance-" + runeEnhanceAmt;
        runeIcon.appendChild(runeEnhance);

        var runeButtons = document.createElement("div");
        runeButtons.className = "rune-buttons";

        runes[g].appendChild(runeIcon);

        var enhanceSelect = document.createElement("select");
        enhanceSelect.id = "enhanceSelect" + (g+1);
        enhanceSelect.className = "form-select index-control form-select-sm enhance-select";
        var option = document.createElement("option");
        for (var i = 0; i < 13; i++) {
          var option = document.createElement("option");
          option.value = i;
          option.text = "+" + i;
          if(i == enhancement) {
            option.selected = true
          }
          enhanceSelect.appendChild(option);
        }
        enhanceSelect.addEventListener("change", function(e) {
          var runeDiv = this.parentElement.parentElement;
          var evoVal = parseInt((parseInt(runeDiv.getAttribute("data-enhancement")) - 1) / 3);
          var enhanceVal = 0;
          if(parseInt(runeDiv.getAttribute("data-enhancement")) != 0) {
            if(parseInt(runeDiv.getAttribute("data-enhancement")) % 3 == 0) {
              var enhanceVal = 3;
            }
            else {
              var enhanceVal = parseInt(runeDiv.getAttribute("data-enhancement")) % 3;
            }
          }
          runeDiv.setAttribute("data-enhancement", this.value);
          var newEvoVal = parseInt((this.value - 1) / 3);
          var newEnhanceVal = 0;
          if(this.value != 0) {
            if(this.value % 3 == 0) {
              var newEnhanceVal = 3;
            }
            else {
              var newEnhanceVal = this.value % 3;
            }
          }
          var evoStats = runeDiv.getAttribute("data-evo-stat").split(",");
          if(newEvoVal < 3) {
            evoStats[4] = 0;
            evoStats[5] = 0;
          }
          if(newEvoVal < 2) {
            evoStats[2] = 0;
            evoStats[3] = 0;
          }
          if(newEvoVal < 1) {
            evoStats[0] = 0;
            evoStats[1] = 0;
          }
          runeDiv.setAttribute("data-evo-stat", evoStats);
          runeDiv.querySelector(".evo").classList.remove("evo-" + evoVal);
          runeDiv.querySelector(".evo").classList.add("evo-" + newEvoVal);
          runeDiv.querySelector(".enhance").classList.remove("enhance-" + enhanceVal);
          runeDiv.querySelector(".enhance").classList.add("enhance-" + newEnhanceVal);
          updateUnit(12);
        });

        var editIcon = document.createElement("i");
        editIcon.className = "fa-solid fa-pen-to-square";
        editIcon.title = "Edit Seal";

        editIcon.addEventListener("click", function(e) {
          var runeDiv = this.parentElement.parentElement;
          var el = document.getElementById("runes").getElementsByClassName("rune-icon");
          for (var i = 0; i < el.length; i++) {
            el[i].className = "rune-icon";
          }
          runeDiv.className += " active";
          setRuneStats(runeDiv);
          var myModal = Modal.getOrCreateInstance(document.getElementById("runeStatsModal"));
          myModal.show();
        });

        var closeIcon = document.createElement("i");
        closeIcon.className = "fa-solid fa-circle-xmark";
        closeIcon.title = "Remove Seal";

        closeIcon.addEventListener("click", function(e) {
          var runeDiv = this.parentElement.parentElement;
          runeDiv.removeAttribute("data-rune-id");
          runeDiv.removeAttribute("data-set");
          runeDiv.removeAttribute("data-enhancement");
          runeDiv.removeAttribute("data-base-stat");
          runeDiv.removeAttribute("data-evo-stat");
          runeDiv.innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          defaultIcon.setAttribute("data-bs-toggle", "modal");
          defaultIcon.setAttribute("data-bs-target", "#runeModal");
          defaultIcon.setAttribute("data-action", "click->planner#runeList");
          var defaultSlot = document.createElement("div");
          defaultSlot.className = "slot slot-" + runeDiv.getAttribute("data-slot");
          defaultIcon.appendChild(defaultSlot);
          runeDiv.append(defaultIcon);
          updateUnit(11);
        });

        var infoLink = document.createElement("a");
        if(locale == "jp") {
          infoLink.href = siteURL + "/jp/rune/" + runeList[rune].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
        }
        else {
          infoLink.href = siteURL + "/rune/" + runeList[rune].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
        }
        infoLink.target = "_blank";
        var infoIcon = document.createElement("i");
        infoIcon.className = "fa-solid fa-circle-info me-0";
        infoIcon.title = "View Seal Page";
        infoLink.appendChild(infoIcon);

        runeButtons.appendChild(enhanceSelect);
        runeButtons.appendChild(editIcon);
        runeButtons.appendChild(closeIcon);
        runeButtons.appendChild(infoLink);

        runes[g].appendChild(runeButtons);
      }
      else {
        runes[g].removeAttribute("data-rune-id");
        runes[g].removeAttribute("data-set");
        runes[g].removeAttribute("data-enhancement");
        runes[g].removeAttribute("data-base-stat");
        runes[g].removeAttribute("data-evo-stat");
      }
    }
  }
}

function setSpirit() {
  addTE = Array(statTypes.length).fill(0);
  scaleTE = Array(statTypes.length).fill(0);

  addTETK = Array(tokkouTypes.length).fill(0);
  addTETK2 = Array(tokkouTypes.length).fill(0);

  if(unitData.hasOwnProperty("truth_equipment")) {
    var spirit = document.getElementById("spiritGear");
    var spiritSelect = spirit.getElementsByTagName("select")[0];
    var enhancement = parseInt(spirit.getAttribute("data-enhancement"));
    var gate7 = parseInt(document.querySelector(".gate-7").getAttribute("data-gate-level"));
    if(gate7 == 6) {
      if(spirit.className.split(/\s+/).indexOf("enabled") == -1) {
        spirit.className = "item-icon enabled";
      }
      spiritSelect.disabled = false;
      for(var s = 0; s < enhancement; s++) {
        if(unitData.truth_equipment.lv_effects_data[s].hasOwnProperty("status")) {
          skill = unitData.truth_equipment.lv_effects_data[s].status.effects;
          for(var i = 0; i < skill.length; i++) {
            var type =  skill[i].type;
            var value =  skill[i].value;
            var calc = skill[i].calc;
            if(calc == 0) {
              if(type == 48) {
                addTE[25] += value;
                addTE[26] += value;
                addTE[27] += value;
                addTE[28] += value;
                addTE[29] += value;
                addTE[30] += value;
                addTE[31] += value;
                addTE[32] += value;
                addTE[33] += value;
                addTE[34] += value;
                addTE[36] += value;
                addTE[37] += value;
                addTE[41] += value;
                addTE[42] += value;
                addTE[43] += value;
                addTE[45] += value;
                addTE[46] += value;
                addTE[105] += value;
              }
              else if(type == 78) {
                addTE[55] += value;
                addTE[56] += value;
                addTE[57] += value;
                addTE[58] += value;
                addTE[59] += value;
                addTE[60] += value;
                addTE[61] += value;
                addTE[62] += value;
                addTE[63] += value;
                addTE[64] += value;
                addTE[66] += value;
                addTE[67] += value;
                addTE[71] += value;
                addTE[73] += value;
                addTE[75] += value;
                addTE[76] += value;
                addTE[106] += value;
              }
              else {
                addTE[type] += value;
              }
            }
            else if(calc == 1) {
              scaleTE[type] += value;
            }
          }
        }
        if(unitData.truth_equipment.lv_effects_data[s].hasOwnProperty("learn_ability") && unitData.truth_equipment.lv_effects_data[s].learn_ability.learn_type == 1) {
          var skill = unitData.truth_equipment.lv_effects_data[s].learn_ability.abil.skl1_data;
          if(skill.timing == 1 && !skill.hasOwnProperty("cond") && skill.hasOwnProperty("t_buff_data") && !skill.t_buff_data.hasOwnProperty("vone1") && !skill.t_buff_data.hasOwnProperty("app_mct")) {
            for(var i = 1; i < 12; i++) {
              var type = eval("skill.t_buff_data.type" + i);
              if(type != undefined) {
                var calc = eval("skill.t_buff_data.calc" + i);
                var value = eval("skill.t_buff_data.vini" + i);
                if(calc == 0) {
                  if(type == 48) {
                    addTE[25] += value;
                    addTE[26] += value;
                    addTE[27] += value;
                    addTE[28] += value;
                    addTE[29] += value;
                    addTE[30] += value;
                    addTE[31] += value;
                    addTE[32] += value;
                    addTE[33] += value;
                    addTE[34] += value;
                    addTE[36] += value;
                    addTE[37] += value;
                    addTE[41] += value;
                    addTE[42] += value;
                    addTE[43] += value;
                    addTE[45] += value;
                    addTE[46] += value;
                    addTE[105] += value;
                  }
                  else if(type == 78) {
                    addTE[55] += value;
                    addTE[56] += value;
                    addTE[57] += value;
                    addTE[58] += value;
                    addTE[59] += value;
                    addTE[60] += value;
                    addTE[61] += value;
                    addTE[62] += value;
                    addTE[63] += value;
                    addTE[64] += value;
                    addTE[66] += value;
                    addTE[67] += value;
                    addTE[71] += value;
                    addTE[73] += value;
                    addTE[75] += value;
                    addTE[76] += value;
                    addTE[106] += value;
                  }
                  else if(type == 153) {
                    var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                    addTETK[tokkou] += value;
                  }
                  else if(type == 190) {
                    var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                    addTETK2[tokkou] += value;
                  }
                  else {
                    addTE[type] += value;
                  }
                }
                else if(calc == 1) {
                  scaleTE[type] += value;
                }
              }
            }
          }
        }
      }
    }
    else {
      spirit.setAttribute("data-enhancement", 0);
      for(var i, a = 0; i = spiritSelect.options[a]; a++) {
        if(i.value == 0) {
          spiritSelect.selectedIndex = a;
          break;
        }
      }
      spirit.className = "item-icon";
      spiritSelect.disabled = true;
    }
  }
}

function setBond() {
  addBond = Array(statTypes.length).fill(0);
  scaleBond = Array(statTypes.length).fill(0);

  addBondTK = Array(tokkouTypes.length).fill(0);
  addBondTK2 = Array(tokkouTypes.length).fill(0);

  var addTempBond = Array(statTypes.length).fill(0);
  var scaleTempBond = Array(statTypes.length).fill(0);
  var addTempBondTK = Array(tokkouTypes.length).fill(0);
  var addTempBondTK2 = Array(tokkouTypes.length).fill(0);

  if(unitData.hasOwnProperty("bond_groups")) {
    var bonds = document.querySelectorAll(".bond-details-box");
    var gates = document.querySelectorAll(".gate");
    var bondFlag = true;
    for(var a = 0; a < gates.length; a++) {
      var gateLevel = parseInt(gates[a].firstChild.getAttribute("data-gate-level"));
      if(gateLevel != 6) {
        bondFlag = false;
        break;
      }
    }
    if(bondFlag) {
      for(var a = 0; a < bonds.length; a++) {
        var bondLevel = parseInt(bonds[a].getAttribute("data-level"));
        if(bonds[a].className.split(/\s+/).indexOf("enabled") == -1) {
          bonds[a].className = "bond-details-box enabled";
        }
        if(bondLevel != 0) {
          if(a != 0) {
            addTempBond = addBond;
            scaleTempBond = scaleBond;
            addTempBondTK = addBondTK;
            addTempBondTK2 = addBondTK2;
            addBond = Array(statTypes.length).fill(0);
            scaleBond = Array(statTypes.length).fill(0);
            addBondTK = Array(tokkouTypes.length).fill(0);
            addBondTK2 = Array(tokkouTypes.length).fill(0);
          }
          for(var s = 0; s < bondLevel; s++) {
            var buff = unitData.bond_groups[a].group_buff.buffs[s].buff;
            for(var i = 1; i < 12; i++) {
              var type = eval("buff.type" + i);
              if(type != undefined) {
                var calc = eval("buff.calc" + i);
                var value = eval("buff.vini" + i);
                if(calc == 0) {
                  if(type == 48) {
                    addBond[25] = value;
                    addBond[26] = value;
                    addBond[27] = value;
                    addBond[28] = value;
                    addBond[29] = value;
                    addBond[30] = value;
                    addBond[31] = value;
                    addBond[32] = value;
                    addBond[33] = value;
                    addBond[34] = value;
                    addBond[36] = value;
                    addBond[37] = value;
                    addBond[41] = value;
                    addBond[42] = value;
                    addBond[43] = value;
                    addBond[45] = value;
                    addBond[46] = value;
                    addBond[105] = value;
                  }
                  else if(type == 78) {
                    addBond[55] = value;
                    addBond[56] = value;
                    addBond[57] = value;
                    addBond[58] = value;
                    addBond[59] = value;
                    addBond[60] = value;
                    addBond[61] = value;
                    addBond[62] = value;
                    addBond[63] = value;
                    addBond[64] = value;
                    addBond[66] = value;
                    addBond[67] = value;
                    addBond[71] = value;
                    addBond[73] = value;
                    addBond[75] = value;
                    addBond[76] = value;
                    addBond[106] = value;
                  }
                  else if(type == 153) {
                    var tokkou = tkTags.indexOf(eval("buff.tktag" + i));
                    addBondTK[tokkou] = value;
                  }
                  else if(type == 190) {
                    var tokkou = tkTags.indexOf(eval("buff.tktag" + i));
                    addBondTK2[tokkou] = value;
                  }
                  else {
                    addBond[type] = value;
                  }
                }
                else if(calc == 1) {
                  scaleBond[type] = value;
                }
              }
            }
          }
          if(a != 0) {
            for(var i = 0; i < statTypes.length; i++) {
              value = addBond[i];
              value2 = scaleBond[i];
              if(addTempBond[i] > value || value < 0 || value == 0) {
                if(value < 0) {
                  if([83, 94, 95, 99, 122, 164, 165, 166, 167, 168, 169 , 170, 171, 172, 173, 174, 175].includes(i)) {
                    if(addTempBond[i] < value) {
                      addBond[i] = addTempBond[i];
                    }
                    else {
                      addBond[i] = value;
                    }
                  }
                }
                else {
                  addBond[i] = addTempBond[i];
                }
              }
              else {
                addBond[i] = value;
              }
              if(scaleTempBond[i] > value2) {
                scaleBond[i] = scaleTempBond[i];
              }
              else {
                scaleBond[i] = value2;
              }
            }
            for(var i = 0; i < tokkouTypes.length; i++) {
              value = addBondTK[i];
              if(addTempBondTK[i] > value) {
                addBondTK[i] = addTempBondTK[i];
              }
              else {
                addBondTK[i] = value
              }
            }
            for(var i = 0; i < tokkouTypes.length; i++) {
              value = addBondTK2[i];
              if(addTempBondTK2[i] > value) {
                addBondTK2[i] = addTempBondTK2[i];
              }
              else {
                addBondTK2[i] = value
              }
            }
          }
        }
      }
    }
    else {
      for(var a = 0; a < bonds.length; a++) {
        if(bonds[a].className.split(/\s+/).indexOf("enabled") != -1) {
          bonds[a].className = "bond-details-box";
          bonds[a].setAttribute("data-level", 0);
          var bondButtons = bonds[a].lastChild.getElementsByClassName("bond-button-box");
          for(i = 0; i < bondButtons.length; i++) {
            bondButtons[i].className = "bond-button-box";
            bondButtons[i].setAttribute("data-active", 0);
          }
        }
      }
    }
  }
}

function setExpedition() {
  addEXP = Array(statTypes.length).fill(0);
  scaleEXP = Array(statTypes.length).fill(0);

  addEXPTK = Array(tokkouTypes.length).fill(0);
  addEXPTK2 = Array(tokkouTypes.length).fill(0);

  if(expeditionList.length != 0) {
    var expeditions = document.querySelectorAll(".expedition");
    for(var a = 0; a < expeditions.length; a++) {
      var expStatus = parseInt(expeditions[a].getAttribute("data-active"));
      if(expStatus != 0) {
        for(var s = 0; s < expeditionList[a].data.quests.length; s++) {
          if(s == expeditionList[a].data.quests.length - 1) {
            var buff = expeditionList[a].data.quests[s].buff_id_data;
            for(var i = 1; i < 12; i++) {
              var type = eval("buff.type" + i);
              if(type != undefined) {
                var calc = eval("buff.calc" + i);
                var value = eval("buff.vini" + i);
                if(calc == 0) {
                  if(type == 48) {
                    addEXP[25] += value;
                    addEXP[26] += value;
                    addEXP[27] += value;
                    addEXP[28] += value;
                    addEXP[29] += value;
                    addEXP[30] += value;
                    addEXP[31] += value;
                    addEXP[32] += value;
                    addEXP[33] += value;
                    addEXP[34] += value;
                    addEXP[36] += value;
                    addEXP[37] += value;
                    addEXP[41] += value;
                    addEXP[42] += value;
                    addEXP[43] += value;
                    addEXP[45] += value;
                    addEXP[46] += value;
                    addEXP[105] += value;
                  }
                  else if(type == 78) {
                    addEXP[55] += value;
                    addEXP[56] += value;
                    addEXP[57] += value;
                    addEXP[58] += value;
                    addEXP[59] += value;
                    addEXP[60] += value;
                    addEXP[61] += value;
                    addEXP[62] += value;
                    addEXP[63] += value;
                    addEXP[64] += value;
                    addEXP[66] += value;
                    addEXP[67] += value;
                    addEXP[71] += value;
                    addEXP[73] += value;
                    addEXP[75] += value;
                    addEXP[76] += value;
                    addEXP[106] += value;
                  }
                  else if(type == 153) {
                    var tokkou = tkTags.indexOf(eval("buff.tktag" + i));
                    addEXPTK[tokkou] += value;
                  }
                  else if(type == 190) {
                    var tokkou = tkTags.indexOf(eval("buff.tktag" + i));
                    addEXPTK2[tokkou] += value;
                  }
                  else {
                    addEXP[type] += value;
                  }
                }
                else if(calc == 1) {
                  scaleEXP[type] += value;
                }
              }
            }
          }
        }
      }
    }
  }
}

function setCrystal() {
  if(locale != "jp") {
    return;
  }
  var crystals = document.getElementById("crystals").querySelectorAll(".crystal-icon");

  for(var g = 0; g < crystals.length; g++) {
    if(crystals[g].hasAttribute("data-crystal-id")) {
      var crystal = crystals[g].getAttribute("data-crystal-id");
      if(crystalList[crystal] != null) {
        var crystalRank = crystals[g].getAttribute("data-rank-id");
        crystals[g].innerHTML = "";
        var crystalIcon = document.createElement("div");
        crystalIcon.className = "icon planner-icon";
        crystalIcon.setAttribute("data-bs-toggle", "modal");
        crystalIcon.setAttribute("data-bs-target", "#crystalModal");
        var crystalImg = document.createElement("img");
        crystalImg.src = imgPath + "/images/CrystalIcon/" + crystalList[crystal].data.icon + ".png";

        crystalIcon.appendChild(crystalImg);

        var crystalButtons = document.createElement("div");
        crystalButtons.className = "crystal-buttons";

        crystals[g].appendChild(crystalIcon);

        var rankSelect = document.createElement("select");
        rankSelect.id = "rankSelect" + (g+1);
        rankSelect.className = "form-select index-control form-select-sm rank-select";
        var option = document.createElement("option");
        for (var i = 0; i < 5; i++) {
          var option = document.createElement("option");
          option.value = i;
          option.text = crystalRanks[i].toUpperCase();
          if(i == crystalRank) {
            option.selected = true
          }
          rankSelect.appendChild(option);
        }
        rankSelect.addEventListener("change", function(e) {
          var crystalDiv = this.parentElement.parentElement;
          crystalDiv.setAttribute("data-rank-id", this.value);
          updateUnit(17);
        });

        var closeIcon = document.createElement("i");
        closeIcon.className = "fa-solid fa-circle-xmark";
        closeIcon.title = "Remove Memory";

        closeIcon.addEventListener("click", function(e) {
          var crystalDiv = this.parentElement.parentElement;
          crystalDiv.removeAttribute("data-crystal-id");
          crystalDiv.removeAttribute("data-rank-id");
          crystalDiv.innerHTML = "";
          var defaultIcon = document.createElement("div");
          defaultIcon.className = "icon empty-icon planner-icon";
          defaultIcon.setAttribute("data-bs-toggle", "modal");
          defaultIcon.setAttribute("data-bs-target", "#crystalModal");
          defaultIcon.setAttribute("data-action", "click->planner#crystalList");
          crystalDiv.append(defaultIcon);
          updateUnit(16);
        });

        var infoLink = document.createElement("a");
        infoLink.href = siteURL + "/jp/crystal/" + crystalList[crystal].data.iname.normalize("NFKC").replace(/_/g, "-").toLowerCase();
        infoLink.target = "_blank";
        var infoIcon = document.createElement("i");
        infoIcon.className = "fa-solid fa-circle-info";
        infoIcon.title = "View Memory Page";
        infoLink.appendChild(infoIcon);

        crystalButtons.appendChild(rankSelect);
        crystalButtons.appendChild(closeIcon);
        crystalButtons.appendChild(infoLink);

        crystals[g].appendChild(crystalButtons);
      }
      else {
        crystals[g].removeAttribute("data-crystal-id");
        crystals[g].removeAttribute("data-rank-id");
      }
    }
  }
}

function setBaseStats() {
  addStats = Array(statTypes.length).fill(0);

  var eq_stats = unitData.jobs_data[unitJob].ranks_stats;

  for (var key in eq_stats) {
    if (!eq_stats.hasOwnProperty(key)) { continue; }
    if(key.indexOf("type") != -1) {
      addStats[eq_stats[key]] = eq_stats["vmax" + eq_stats[key]];
    }
  }

  var baseHP = Math.trunc(unitData.hp + Math.trunc(100000 * ((unitData.mhp - unitData.hp) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseHP += Math.trunc(baseHP * unitData.jobs_data[unitJob].hp / 100.0);
  addStats[2] += baseHP;
  document.getElementById("hp").textContent = addStats[2];

  var baseMP = Math.trunc(unitData.mp + Math.trunc(100000 * ((unitData.mmp - unitData.mp) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseMP += Math.trunc(baseMP * unitData.jobs_data[unitJob].mp / 100.0);
  addStats[3] += baseMP;
  document.getElementById("mp").textContent = addStats[3];

  var baseATK = Math.trunc(unitData.atk + Math.trunc(100000 * ((unitData.matk - unitData.atk) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseATK += Math.trunc(baseATK * unitData.jobs_data[unitJob].atk / 100.0);
  addStats[5] += baseATK;
  document.getElementById("atk").textContent = addStats[5];

  var baseDEF = Math.trunc(unitData.def + Math.trunc(100000 * ((unitData.mdef - unitData.def) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseDEF += Math.trunc(baseDEF * unitData.jobs_data[unitJob].def / 100.0);
  addStats[6] += baseDEF;
  document.getElementById("def").textContent = addStats[6];

  var baseMAG = Math.trunc(unitData.mag + Math.trunc(100000 * ((unitData.mmag - unitData.mag) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseMAG += Math.trunc(baseMAG * unitData.jobs_data[unitJob].mag / 100.0);
  addStats[7] += baseMAG;
  document.getElementById("mag").textContent = addStats[7];

  var baseMND = Math.trunc(unitData.mnd + Math.trunc(100000 * ((unitData.mmnd - unitData.mnd) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseMND += Math.trunc(baseMND * unitData.jobs_data[unitJob].mnd / 100.0);
  addStats[8] += baseMND;
  document.getElementById("mnd").textContent = addStats[8];

  var baseDEX = Math.trunc(unitData.dex + Math.trunc(100000 * ((unitData.mdex - unitData.dex) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseDEX += Math.trunc(baseDEX * unitData.jobs_data[unitJob].dex / 100.0);
  addStats[10] += baseDEX;
  document.getElementById("dex").textContent = addStats[10];

  var baseSPD = Math.trunc(unitData.spd + Math.trunc(100000 * ((unitData.mspd - unitData.spd) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseSPD += Math.trunc(baseSPD * unitData.jobs_data[unitJob].spd / 100.0);
  addStats[11] += baseSPD;
  document.getElementById("spd").textContent = addStats[11];

  var baseCRI = Math.trunc(unitData.cri + Math.trunc(100000 * ((unitData.mcri - unitData.cri) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseCRI += Math.trunc(baseCRI * unitData.jobs_data[unitJob].cri / 100.0);
  addStats[12] += baseCRI;
  document.getElementById("cri").textContent = addStats[12];

  var baseLUK = Math.trunc(unitData.luk + Math.trunc(100000 * ((unitData.mluk - unitData.luk) / 99.0)) * ((unitLevel - 1) / 100000.0));
  baseLUK += Math.trunc(baseLUK * unitData.jobs_data[unitJob].luk / 100.0);
  addStats[13] += baseLUK;
  document.getElementById("luk").textContent = addStats[13];

  var baseMove = unitData.jobs_data[unitJob].jmov;
  addStats[14] += baseMove;

  var baseJmp = unitData.jobs_data[unitJob].jjmp;
  addStats[15] += baseJmp;

  var baseHealing = 100;
  addStats[9] += baseHealing;

  if(unitData.jobs_data[unitJob].avoid != 0) {
    addStats[80] += unitData.jobs_data[unitJob].avoid;
  }

  if(unitData.hasOwnProperty("elem_buff") && unitData.elem_buff.hasOwnProperty("buff_data")) {
    for(var i = 1; i < 12; i++) {
      var type = eval("unitData.elem_buff.buff_data.type" + i);
      if(type != undefined) {
        var vini = eval("unitData.elem_buff.buff_data.vini" + i);
        addStats[type] += vini;
      }
    }
  }
}

function updateSkills() {
  var jobs = document.querySelectorAll(".job-link");
  var jobsLength = unitData.jobsets_data.length;
  var skills = document.querySelectorAll(".skill-details .skill-details-box");
  var skillCount = skills.length;
  var newSkills = [];
  var newCount = 0;

  for(var a = 0; a < jobs.length; a++) {
    var jobID = jobs[a].getAttribute("data-job-id");
    for(var i = 0; i < jobsLength; i++) {
      if(jobID == i) {
        for(var s = 2; s < 11; s++) {
          if(unitData.jobs_data[i].hasOwnProperty("learn_skill_" + s + "_data")) {
            var ability = eval("unitData.jobs_data[" + i + "].learn_skill_" + s + "_data");
            if(ability.slot == 1 && (!ability.skl1_data.hasOwnProperty("cond") || ability.hasOwnProperty("skl2_data") && !ability.skl2_data.hasOwnProperty("cond"))) {
              newSkills.push({"job_id": i, "skill_id": s, "skill": 0, "skill_text": eval("ability.skl1_data.name")})
              newCount += 1;
            }
          }
        }
      }
    }
  }

  for (var i = 0; i < newSkills.length; i++) {
    if(i >= skillCount) {
      var jobSkills = document.getElementById("jobSkills");
      var skillDiv = document.createElement("div");
      skillDiv.className = "skill-details";
      var skillDetails = document.createElement("div");
      skillDetails.className = "skill-details-box d-flex";
      skillDetails.setAttribute("data-job-id", newSkills[i].job_id);
      skillDetails.setAttribute("data-skill-id", newSkills[i].skill_id);
      skillDetails.setAttribute("data-skill", 0);
      var skillIcon = document.createElement("div");
      skillIcon.className = "ability-type-icon ability-type-1";
      var skillTextDiv = document.createElement("div");
      skillTextDiv.className = "flex-grow-1 align-self-center ms-2 text-start";
      var skillText = document.createTextNode(newSkills[i].skill_text);

      skillDetails.addEventListener("click", function(e) {
        var skillStatus = this.getAttribute("data-skill");
        if(skillStatus == 0 && document.querySelectorAll(".skill-details .skill-details-box.selected").length < 2) {
          this.className = "skill-details-box d-flex selected";
          this.setAttribute("data-skill", 1);
        }
        else if(skillStatus == 1) {
          this.className = "skill-details-box d-flex";
          this.setAttribute("data-skill", 0);
        }
        updateUnit(2);
      });

      skillTextDiv.appendChild(skillText);
      skillDetails.appendChild(skillIcon);
      skillDetails.appendChild(skillTextDiv);
      skillDiv.appendChild(skillDetails);

      jobSkills.appendChild(skillDiv);
    }
    else {
      skills[i].setAttribute("data-job-id", newSkills[i].job_id);
      skills[i].setAttribute("data-skill-id", newSkills[i].skill_id);
      if(newCount == skillCount) {
        skills[i].setAttribute("data-skill", skills[i].getAttribute("data-skill"));
      }
      else {
        skills[i].setAttribute("data-skill", 0);
        skills[i].className = "skill-details-box d-flex";
      }
      skills[i].childNodes[0].className = "ability-type-icon ability-type-1";
      skills[i].childNodes[1].innerHTML = newSkills[i].skill_text;
    }
  }

  if(newCount < skillCount) {
    while (newCount < skillCount) {
      skills[newCount].parentNode.remove();
      newCount++;
    }
  }
}

function updateGear() {
  var gears = document.getElementById("gear").querySelectorAll(".gear-icon");

  addGear = Array(statTypes.length).fill(0);
  subGear = Array(statTypes.length).fill(0);
  scaleGear = Array(statTypes.length).fill(0);
  addGA = Array(statTypes.length).fill(0);
  scaleGA = Array(statTypes.length).fill(0);
  addGearTK = Array(tokkouTypes.length).fill(0);
  addGearTK2 = Array(tokkouTypes.length).fill(0);
  addGATK = Array(tokkouTypes.length).fill(0);
  addGATK2 = Array(tokkouTypes.length).fill(0);

  var gear_array = [];
  var skill_array = [];

  for(var g = 0; g < gears.length; g++) {
    if(gears[g].hasAttribute("data-gear-id")) {
      var gear = gears[g].getAttribute("data-gear-id");
      gear_array.push(gearList[gear].data.iname);
    }
  }

  for(var g = 0; g < gears.length; g++) {
    if(gears[g].hasAttribute("data-gear-id")) {
      var gear = gears[g].getAttribute("data-gear-id");
      var cnd_flag = true;
      var sm_flag = false;
      if(gearList[gear].data.hasOwnProperty("cond_sm_data")) {
        var conds = gearList[gear].data.cond_sm_data.datas;
        cnd_flag = false;
        sm_flag = true;
        for(var a = 0; a < conds.length; a++) {
          if(conds[a].hasOwnProperty("unit_ids")) {
            cnd_flag = false;
            for(var b = 0; b < conds[a].unit_ids.length; b++) {
              if(unitData.iname == conds[a].unit_ids[b]) {
                cnd_flag = true;
                break;
              }
            }
          }
          if(conds[a].hasOwnProperty("job_ids")) {
            cnd_flag = false;
            for(var b = 0; b < conds[a].job_ids.length; b++) {
              if(unitData.jobsets_data[unitJob].iname == conds[a].job_ids[b]) {
                cnd_flag = true;
                break;
              }
            }
          }
          if(cnd_flag) {
            break;
          }
        }
      }
      if(!sm_flag || (sm_flag && !cnd_flag)) {
        cnd_flag = true;
        if(gearList[gear].data.hasOwnProperty("units")) {
          cnd_flag = false;
          for(var a = 0; a < gearList[gear].data.units.length; a++) {
            if(unitData.iname == gearList[gear].data.units[a]) {
              cnd_flag = true;
              break;
            }
          }
          if(!cnd_flag) {
            continue;
          }
        }
        if(gearList[gear].data.hasOwnProperty("jobs")) {
          cnd_flag = false;
          for(var a = 0; a < gearList[gear].data.jobs.length; a++) {
            if(unitData.jobs_data[unitJob].iname == gearList[gear].data.jobs[a] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == gearList[gear].data.jobs[a])) {
              cnd_flag = true;
              break;
            }
          }
          if(!cnd_flag) {
            continue;
          }
        }
        if(gearList[gear].data.hasOwnProperty("birth")) {
          if(gearList[gear].data.birth != unitData.birth) {
            cnd_flag = false;
            continue;
          }
        }
        if(gearList[gear].data.hasOwnProperty("sex")) {
          if(gearList[gear].data.sex != unitData.sex) {
            cnd_flag = false;
            continue;
          }
        }
        if(gearList[gear].data.hasOwnProperty("elem")) {
          if(gearList[gear].data.elem != unitData.elem) {
            cnd_flag = false;
            continue;
          }
        }
        if(gearList[gear].data.type == 1) {
          if(unitData.jobs_data[unitJob].hasOwnProperty("artifact_data") && unitData.jobs_data[unitJob].artifact_data.hasOwnProperty("tag")) {
            if(unitData.jobs_data[unitJob].artifact_data.tag != gearList[gear].data.tag) {
              cnd_flag = false;
              continue;
            }
          }
          else {
            cnd_flag = false;
            continue;
          }
        }
      }
      if(cnd_flag) {
        var gearRank = gears[g].getAttribute("data-rank-id");
        var minRank = gears[g].getAttribute("data-min-id");
        var gearButtons = gears[g].querySelector(".gear-buttons");
        var minusIcon = gearButtons.querySelector(".fa-circle-minus");
        var addIcon = gearButtons.querySelector(".fa-circle-plus");
        var equipData = "";

        if(gearRank != 5) {
          addIcon.classList.remove("disabled");
        }
        else if(addIcon != null) {
          addIcon.classList.add("disabled");
        }

        if(gearRank != minRank) {
          minusIcon.classList.remove("disabled");
        }
        else if(minusIcon != null) {
          minusIcon.classList.add("disabled");
        }

        if(gearList[gear].data.hasOwnProperty("equip5_data") && gearRank >= 5) {
          equipData = "equip5_data";
        }
        else if(gearList[gear].data.hasOwnProperty("equip4_data") && gearRank >= 4) {
          equipData = "equip4_data";
        }
        else if(gearList[gear].data.hasOwnProperty("equip3_data") && gearRank >= 3) {
          equipData = "equip3_data";
        }
        else if(gearList[gear].data.hasOwnProperty("equip2_data") && gearRank >= 2) {
          equipData = "equip2_data";
        }
        else if(gearList[gear].data.hasOwnProperty("equip1_data") && gearRank >= 1) {
          equipData = "equip1_data";
        }

        if(equipData != "") {
          var maxLevel = (gearRank-1) * 5 + 10 - 1;
          var buffType = "";
          if(eval("gearList[" + gear + "].data." + equipData).hasOwnProperty("t_buff_data")) {
            buffType = "t_buff_data";
          }
          else if(eval("gearList[" + gear + "].data." + equipData).hasOwnProperty("s_buff_data")) {
            buffType = "s_buff_data";
          }
          if(buffType != "") {
            for(var i = 1; i < 12; i++) {
              var type = eval("gearList[" + gear + "].data." + equipData + ".t_buff_data.type" + i);
              if(type != undefined) {
                var value = 0;
                var min_value = eval("gearList[" + gear + "].data." + equipData + ".t_buff_data.vini" + i);
                var max_value = eval("gearList[" + gear + "].data." + equipData + ".t_buff_data.vmax" + i);
                var calc = eval("gearList[" + gear + "].data." + equipData + ".t_buff_data.calc" + i);
                if(min_value == max_value) {
                  value = min_value;
                }
                else if(gearRank == 5) {
                  value = max_value;
                }
                else {
                  value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / 29)) * maxLevel / 100)
                }

                if(calc == 0 && (addGear[type] < value || value < 0)) {
                  if(value < 0) {
                    if([83, 94, 95, 99, 122, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175].includes(type)) {
                      if(addGear[type] > value) {
                        addGear[type] = value;
                      }
                    }
                    else {
                      if(subGear[type] > value) {
                        subGear[type] = value;
                      }
                    }
                  }
                  else if([83, 94, 95, 99, 122, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175].includes(type)) {
                    if(subGear[type] < value) {
                      subGear[type] = value;
                    }
                  }
                  else {
                    if(type == 48) {
                      if(addGear[25] < value) {
                        addGear[25] = value;
                      }
                      if(addGear[26] < value) {
                        addGear[26] = value;
                      }
                      if(addGear[27] < value) {
                        addGear[27] = value;
                      }
                      if(addGear[28] < value) {
                        addGear[28] = value;
                      }
                      if(addGear[29] < value) {
                        addGear[29] = value;
                      }
                      if(addGear[30] < value) {
                        addGear[30] = value;
                      }
                      if(addGear[31] < value) {
                        addGear[31] = value;
                      }
                      if(addGear[32] < value) {
                        addGear[32] = value;
                      }
                      if(addGear[33] < value) {
                        addGear[33] = value;
                      }
                      if(addGear[34] < value) {
                        addGear[34] = value;
                      }
                      if(addGear[36] < value) {
                        addGear[36] = value;
                      }
                      if(addGear[37] < value) {
                        addGear[37] = value;
                      }
                      if(addGear[41] < value) {
                        addGear[41] = value;
                      }
                      if(addGear[42] < value) {
                        addGear[42] = value;
                      }
                      if(addGear[43] < value) {
                        addGear[43] = value;
                      }
                      if(addGear[45] < value) {
                        addGear[45] = value;
                      }
                      if(addGear[46] < value) {
                        addGear[46] = value;
                      }
                      if(addGear[105] < value) {
                        addGear[105] = value;
                      }
                    }
                    else if(type == 78) {
                      if(addGear[55] < value) {
                        addGear[55] = value;
                      }
                      if(addGear[56] < value) {
                        addGear[56] = value;
                      }
                      if(addGear[57] < value) {
                        addGear[57] = value;
                      }
                      if(addGear[58] < value) {
                        addGear[58] = value;
                      }
                      if(addGear[59] < value) {
                        addGear[59] = value;
                      }
                      if(addGear[60] < value) {
                        addGear[60] = value;
                      }
                      if(addGear[61] < value) {
                        addGear[61] = value;
                      }
                      if(addGear[62] < value) {
                        addGear[62] = value;
                      }
                      if(addGear[63] < value) {
                        addGear[63] = value;
                      }
                      if(addGear[64] < value) {
                        addGear[64] = value;
                      }
                      if(addGear[66] < value) {
                        addGear[66] = value;
                      }
                      if(addGear[67] < value) {
                        addGear[67] = value;
                      }
                      if(addGear[71] < value) {
                        addGear[71] = value;
                      }
                      if(addGear[73] < value) {
                        addGear[73] = value;
                      }
                      if(addGear[75] < value) {
                        addGear[75] = value;
                      }
                      if(addGear[76] < value) {
                        addGear[76] = value;
                      }
                      if(addGear[106] < value) {
                        addGear[106] = value;
                      }
                    }
                    else if(type == 153) {
                      var tokkou = tkTags.indexOf(eval("gearList[" + gear + "].data." + equipData + ".t_buff_data.tktag" + i));
                      if(addGearTK[tokkou] < value) {
                        addGearTK[tokkou] = value;
                      }
                    }
                    else if(type == 190) {
                      var tokkou = tkTags.indexOf(eval("gearList[" + gear + "].data." + equipData + ".t_buff_data.tktag" + i));
                      if(addGearTK2[tokkou] < value) {
                        addGearTK2[tokkou] = value;
                      }
                    }
                    else {
                      addGear[type] = value;
                    }
                  }
                }
                else if(calc == 1 && (scaleGear[type] < value)) {
                  scaleGear[type] = value;
                }
              }
            }
          }
        }
        if(gearList[gear].data.hasOwnProperty("abils_data")) {
          var abilityCount = gearList[gear].data.abils_data.length;
          for(var s = 0; s < abilityCount; s++) {
            var duplicate_flag = false;
            var skill = gearList[gear].data.abils_data[s].skl1_data;
            for(var c = 0; c < skill_array.length; c++) {
              if(skill_array[c] == skill.iname) {
                duplicate_flag = true;
                break;
              }
            }
            if(duplicate_flag) {
              continue;
            }
            else {
              skill_array.push(skill.iname);
            }
            if((skill.timing != 1 && skill.timing != 8) || skill.hasOwnProperty("cond") || (!skill.hasOwnProperty("t_buff_data") && !skill.hasOwnProperty("s_buff_data")) || ((!skill.hasOwnProperty("t_buff_data") || skill.hasOwnProperty("t_buff_data") && (skill.t_buff_data.timing != 1 || skill.t_buff_data.hasOwnProperty("vone1") || skill.t_buff_data.hasOwnProperty("app_mct"))) && (!skill.hasOwnProperty("s_buff_data") || skill.hasOwnProperty("s_buff_data") && (skill.s_buff_data.timing != 1 || skill.s_buff_data.hasOwnProperty("vone1") || skill.s_buff_data.hasOwnProperty("app_mct"))))) {
              continue;
            }
            var cnd_flag = true;
            if(gearList[gear].data.abils_data[s].hasOwnProperty("units")) {
              var arrayLength = gearList[gear].data.abils_data[s].units.length;
              cnd_flag = false;
              for(var u = 0; u < arrayLength; u++) {
                if(unitData.iname == gearList[gear].data.abils_data[s].units[u]) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(gearList[gear].data.abils_data[s].hasOwnProperty("jobs")) {
              var arrayLength = gearList[gear].data.abils_data[s].jobs.length;
              cnd_flag = false;
              for(var u = 0; u < arrayLength; u++) {
                if(unitData.jobs_data[unitJob].iname == gearList[gear].data.abils_data[s].jobs[u] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == gearList[gear].data.abils_data[s].jobs[u])) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(gearList[gear].data.abils_data[s].hasOwnProperty("birth")) {
              if(gearList[gear].data.abils_data[s].birth != unitData.birth) {
                cnd_flag = false;
                continue;
              }
            }
            if(gearList[gear].data.abils_data[s].hasOwnProperty("elem")) {
              if(gearList[gear].data.abils_data[s].elem != unitData.elem) {
                cnd_flag = false;
                continue;
              }
            }
            if(gearList[gear].data.abils_data[s].hasOwnProperty("sex")) {
              if(gearList[gear].data.abils_data[s].sex != unitData.sex) {
                cnd_flag = false;
                continue;
              }
            }
            if(gearRank < (gearList[gear].data.abrares[s]+1) || (gearList[gear].data.abils_data[s].hasOwnProperty("base_abil_data") && gearList[gear].data.abils_data[s].base_abil_data.hasOwnProperty("artifact_data") && !gear_array.includes(gearList[gear].data.abils_data[s].base_abil_data.artifact_data[0].iname))) {
              cnd_flag = false;
              continue;
            }
            // If SkillAbilityDerive changes unit passive skill would need to add code for it instead of ignoring
            if(gearList[gear].data.abils_data[s].hasOwnProperty("sad")) {
              cnd_flag = false;
              continue;
            }

            if(cnd_flag) {
              if((skill.timing == 1 || skill.timing == 8) && !skill.hasOwnProperty("cond") && skill.hasOwnProperty("t_buff_data") && skill.t_buff_data.timing == 1 && !skill.t_buff_data.hasOwnProperty("vone1") && !skill.t_buff_data.hasOwnProperty("app_mct")) {
                for(var i = 1; i < 12; i++) {
                  var type = eval("skill.t_buff_data.type" + i);
                  if(type != undefined) {
                    var value = 0;
                    var min_value = eval("skill.t_buff_data.vini" + i);
                    var calc = eval("skill.t_buff_data.calc" + i);
                    value = min_value;

                    if(calc == 0) {
                      if(type == 48) {
                        addGA[25] += value;
                        addGA[26] += value;
                        addGA[27] += value;
                        addGA[28] += value;
                        addGA[29] += value;
                        addGA[30] += value;
                        addGA[31] += value;
                        addGA[32] += value;
                        addGA[33] += value;
                        addGA[34] += value;
                        addGA[36] += value;
                        addGA[37] += value;
                        addGA[41] += value;
                        addGA[42] += value;
                        addGA[43] += value;
                        addGA[45] += value;
                        addGA[46] += value;
                        addGA[105] += value;
                      }
                      else if(type == 78) {
                        addGA[55] += value;
                        addGA[56] += value;
                        addGA[57] += value;
                        addGA[58] += value;
                        addGA[59] += value;
                        addGA[60] += value;
                        addGA[61] += value;
                        addGA[62] += value;
                        addGA[63] += value;
                        addGA[64] += value;
                        addGA[66] += value;
                        addGA[67] += value;
                        addGA[71] += value;
                        addGA[73] += value;
                        addGA[75] += value;
                        addGA[76] += value;
                        addGA[106] += value;
                      }
                      else if(type == 153) {
                        var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                        addGATK[tokkou] += value;
                      }
                      else if(type == 190) {
                        var tokkou = tkTags.indexOf(eval("skill.t_buff_data.tktag" + i));
                        addGATK2[tokkou] += value;
                      }
                      else {
                        addGA[type] += value;
                      }
                    }
                    else if(calc == 1 && (scaleGA[type] < value)) {
                      scaleGA[type] = value;
                    }
                  }
                }
              }
              if((skill.timing == 1 || skill.timing == 8) && !skill.hasOwnProperty("cond") && skill.hasOwnProperty("s_buff_data") && skill.s_buff_data.timing == 1 && !skill.s_buff_data.hasOwnProperty("vone1") && !skill.s_buff_data.hasOwnProperty("app_mct")) {
                for(var i = 1; i < 12; i++) {
                  var type = eval("skill.s_buff_data.type" + i);
                  if(type != undefined) {
                    var value = 0;
                    var min_value = eval("skill.s_buff_data.vini" + i);
                    var calc = eval("skill.s_buff_data.calc" + i);
                    value = min_value;

                    if(calc == 0) {
                      if(type == 48) {
                        addGA[25] += value;
                        addGA[26] += value;
                        addGA[27] += value;
                        addGA[28] += value;
                        addGA[29] += value;
                        addGA[30] += value;
                        addGA[31] += value;
                        addGA[32] += value;
                        addGA[33] += value;
                        addGA[34] += value;
                        addGA[36] += value;
                        addGA[37] += value;
                        addGA[41] += value;
                        addGA[42] += value;
                        addGA[43] += value;
                        addGA[45] += value;
                        addGA[46] += value;
                        addGA[105] += value;
                      }
                      else if(type == 78) {
                        addGA[55] += value;
                        addGA[56] += value;
                        addGA[57] += value;
                        addGA[58] += value;
                        addGA[59] += value;
                        addGA[60] += value;
                        addGA[61] += value;
                        addGA[62] += value;
                        addGA[63] += value;
                        addGA[64] += value;
                        addGA[66] += value;
                        addGA[67] += value;
                        addGA[71] += value;
                        addGA[73] += value;
                        addGA[75] += value;
                        addGA[76] += value;
                        addGA[106] += value;
                      }
                      else if(type == 153) {
                        var tokkou = tkTags.indexOf(eval("skill.s_buff_data.tktag" + i));
                        addGATK[tokkou] += value;
                      }
                      else if(type == 190) {
                        var tokkou = tkTags.indexOf(eval("skill.s_buff_data.tktag" + i));
                        addGATK2[tokkou] += value;
                      }
                      else {
                        addGA[type] += value;
                      }
                    }
                    else if(calc == 1 && (scaleGA[type] < value)) {
                      scaleGA[type] = value;
                    }
                  }
                }
              }
            }
          }
        }
      }
      else {
        gears[g].removeAttribute("data-gear-id");
        gears[g].removeAttribute("data-type-id");
        gears[g].removeAttribute("data-rank-id");
        gears[g].removeAttribute("data-min-id");
        gears[g].className = "gear-icon";
        gears[g].innerHTML = "";
        var defaultIcon = document.createElement("div");
        defaultIcon.className = "icon empty-icon planner-icon";
        defaultIcon.setAttribute("data-bs-toggle", "modal");
        defaultIcon.setAttribute("data-bs-target", "#gearModal");
        defaultIcon.setAttribute("data-action", "click->planner#gearList");
        gears[g].appendChild(defaultIcon);
      }
    }
  }
}

function updateCard() {
  var cards = document.getElementById("cardEquipment").querySelectorAll(".card-icon");

  addCard = Array(statTypes.length).fill(0);
  addCardGS = Array(statTypes.length).fill(0);
  addCA = Array(statTypes.length).fill(0);
  scaleCA = Array(statTypes.length).fill(0);
  addCardTK = Array(tokkouTypes.length).fill(0);
  addCardTK2 = Array(tokkouTypes.length).fill(0);
  addCardGSTK = Array(tokkouTypes.length).fill(0);
  addCardGSTK2 = Array(tokkouTypes.length).fill(0);
  addCATK = Array(tokkouTypes.length).fill(0);
  addCATK2 = Array(tokkouTypes.length).fill(0);

  var addTempCardGS = Array(statTypes.length).fill(0);
  var addTempCardGSTK = Array(tokkouTypes.length).fill(0);
  var addTempCardGSTK2 = Array(tokkouTypes.length).fill(0);

  for(var g = 0; g < cards.length; g++) {
    if(cards[g].hasAttribute("data-card-id")) {
      var card = cards[g].getAttribute("data-card-id");
      var cardLB = cards[g].getAttribute("data-limit-break");
      var cardButtons = cards[g].querySelector(".card-buttons");
      var cardLevel = 0;
      var maxCardLevel = 0;
      if(cardList[card].data.hasOwnProperty("lvcap")) {
        cardLevel = cardList[card].data.lvcap - 1;
        maxCardLevel = cardList[card].data.lvcap - 1;
      }
      else {
        cardLevel = 10 + (cardList[card].data.rare * 5) + (cardLB * 2) - 1;
        maxCardLevel = 10 + (cardList[card].data.rare * 5) + 10 - 1;
      }

      if(!cardList[card].data.hasOwnProperty("lvcap")) {
        var minusIcon = cardButtons.querySelector(".fa-circle-minus");
        var addIcon = cardButtons.querySelector(".fa-circle-plus");

        if(cardLB != 5) {
          addIcon.classList.remove("disabled");
        }
        else {
          addIcon.classList.add("disabled");
        }

        if(cardLB != 0) {
          minusIcon.classList.remove("disabled");
        }
        else {
          minusIcon.classList.add("disabled");
        }
      }

      if(cardList[card].data.hasOwnProperty("stats")) {
        for(var i = 1; i < 12; i++) {
          var type = eval("cardList[" + card + "].data.stats.statusup_skill_data" + ".t_buff_data.type" + i);
          if(type != undefined) {
            var value = 0;
            var min_value = eval("cardList[" + card + "].data.stats.statusup_skill_data" + ".t_buff_data.vini" + i);
            var max_value = eval("cardList[" + card + "].data.stats.statusup_skill_data" + ".t_buff_data.vmax" + i);
            var calc = eval("cardList[" + card + "].data.stats.statusup_skill_data" + ".t_buff_data.calc" + i);
            if(min_value == max_value) {
              value = min_value;
            }
            else if(cardLevel == maxCardLevel) {
              value = max_value;
            }
            else {
              value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / maxCardLevel)) * cardLevel / 100)
            }

            if(g != 0 && (cardList[card].data.stats.hasOwnProperty("is_decrease_eff") && cardList[card].data.stats.is_decrease_eff == 1)) {
              value = Math.trunc(value * subM[cardLB]);
            }

            if(calc == 0 && (addCard[type] < value || value < 0)) {
              if(value < 0) {
                if([83, 94, 95, 99, 122, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175].includes(type)) {
                  if(addCard[type] > value) {
                    addCard[type] = value;
                  }
                }
              }
              else {
                if(type == 48) {
                  if(addCard[25] < value) {
                    addCard[25] = value;
                  }
                  if(addCard[26] < value) {
                    addCard[26] = value;
                  }
                  if(addCard[27] < value) {
                    addCard[27] = value;
                  }
                  if(addCard[28] < value) {
                    addCard[28] = value;
                  }
                  if(addCard[29] < value) {
                    addCard[29] = value;
                  }
                  if(addCard[30] < value) {
                    addCard[30] = value;
                  }
                  if(addCard[31] < value) {
                    addCard[31] = value;
                  }
                  if(addCard[32] < value) {
                    addCard[32] = value;
                  }
                  if(addCard[33] < value) {
                    addCard[33] = value;
                  }
                  if(addCard[34] < value) {
                    addCard[34] = value;
                  }
                  if(addCard[36] < value) {
                    addCard[36] = value;
                  }
                  if(addCard[37] < value) {
                    addCard[37] = value;
                  }
                  if(addCard[41] < value) {
                    addCard[41] = value;
                  }
                  if(addCard[42] < value) {
                    addCard[42] = value;
                  }
                  if(addCard[43] < value) {
                    addCard[43] = value;
                  }
                  if(addCard[45] < value) {
                    addCard[45] = value;
                  }
                  if(addCard[46] < value) {
                    addCard[46] = value;
                  }
                  if(addCard[105] < value) {
                    addCard[105] = value;
                  }
                }
                else if(type == 78) {
                  if(addCard[55] < value) {
                    addCard[55] = value;
                  }
                  if(addCard[56] < value) {
                    addCard[56] = value;
                  }
                  if(addCard[57] < value) {
                    addCard[57] = value;
                  }
                  if(addCard[58] < value) {
                    addCard[58] = value;
                  }
                  if(addCard[59] < value) {
                    addCard[59] = value;
                  }
                  if(addCard[60] < value) {
                    addCard[60] = value;
                  }
                  if(addCard[61] < value) {
                    addCard[61] = value;
                  }
                  if(addCard[62] < value) {
                    addCard[62] = value;
                  }
                  if(addCard[63] < value) {
                    addCard[63] = value;
                  }
                  if(addCard[64] < value) {
                    addCard[64] = value;
                  }
                  if(addCard[66] < value) {
                    addCard[66] = value;
                  }
                  if(addCard[67] < value) {
                    addCard[67] = value;
                  }
                  if(addCard[71] < value) {
                    addCard[71] = value;
                  }
                  if(addCard[73] < value) {
                    addCard[73] = value;
                  }
                  if(addCard[75] < value) {
                    addCard[75] = value;
                  }
                  if(addCard[76] < value) {
                    addCard[76] = value;
                  }
                  if(addCard[106] < value) {
                    addCard[106] = value;
                  }
                }
                else if(type == 153) {
                  var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.stats.statusup_skill_data" + ".t_buff_data.tktag" + i));
                  if(addCardTK[tokkou] < value) {
                    addCardTK[tokkou] = value;
                  }
                }
                else if(type == 190) {
                  var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.stats.statusup_skill_data" + ".t_buff_data.tktag" + i));
                  if(addCardTK2[tokkou] < value) {
                    addCardTK2[tokkou] = value;
                  }
                }
                else {
                  addCard[type] = value;
                }
              }
            }
          }
        }
      }

      if(cardList[card].data.hasOwnProperty("card_skills")) {
        var skillCount = cardList[card].data.card_skills.length;
        var cardSkills = [];

        if(g != 0) {
          addTempCardGS = addCardGS;
          addTempCardGSTK = addCardGSTK;
          addTempCardGSTK2 = addCardGSTK2;
          addCardGS = Array(statTypes.length).fill(0);
          addCardGSTK = Array(tokkouTypes.length).fill(0);
          addCardGSTK2 = Array(tokkouTypes.length).fill(0);
        }

        for(var a = 0; a < skillCount; a++) {
          var cnd_flag = true;

          if(cardSkills.includes(cardList[card].data.card_skills[a].card_skill)) {
            continue;
          }

          if(cardList[card].data.card_skills[a].hasOwnProperty("cnds_data")) {
            var skill = cardList[card].data.card_skills[a].cnds_data;
            if(skill.hasOwnProperty("birth_id")) {
              var arrayLength = skill.birth_id.length;
              cnd_flag = false;
              for(var c = 0; c < arrayLength; c++) {
                if(unitData.hasOwnProperty("birth_id") && skill.birth_id[c] == unitData.birth_id) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(skill.hasOwnProperty("el_fire") || skill.hasOwnProperty("el_watr") || skill.hasOwnProperty("el_wind") || skill.hasOwnProperty("el_thdr") || skill.hasOwnProperty("el_lit") || skill.hasOwnProperty("el_drk")) {
              cnd_flag = false;
              if(skill.hasOwnProperty("el_fire")) {
                if(unitData.elem == 1) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_watr")) {
                if(unitData.elem == 2) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_wind")) {
                if(unitData.elem == 3) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_thdr")) {
                if(unitData.elem == 4) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_lit")) {
                if(unitData.elem == 5) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_drk")) {
                if(unitData.elem == 6) {
                  cnd_flag = true;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(skill.hasOwnProperty("sex")) {
              if(skill.sex != unitData.sex) {
                cnd_flag = false;
                continue;
              }
            }
            if(skill.hasOwnProperty("unit_group_data")) {
              var arrayLength = skill.unit_group_data.units.length;
              cnd_flag = false;
              for(var c = 0; c < arrayLength; c++) {
                if(skill.unit_group_data.units[c] == unitData.iname) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(skill.hasOwnProperty("job_group_data")) {
              var arrayLength = skill.job_group_data.jobs.length;
              cnd_flag = false;
              for(var c = 0; c < arrayLength; c++) {
                if(unitData.jobs_data[unitJob].iname == skill.job_group_data.jobs[c] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == skill.job_group_data.jobs[c])) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
          }

          var buff = cardList[card].data.card_skills[a].card_skill_data.t_buff_data;
          var buff_cnd_flag = true;
          var custom_target_flag = true;

          if(buff.hasOwnProperty("unit_group_data")) {
            var arrayLength = buff.unit_group_data.units_data.length;
            buff_cnd_flag = false;
            for(var c = 0; c < arrayLength; c++) {
              if(buff.unit_group_data.units_data[c].iname == unitData.iname) {
                buff_cnd_flag = true;
                break;
              }
            }
          }
          if(buff.hasOwnProperty("birth")) {
            if(buff.birth != unitData.birth) {
              buff_cnd_flag = false;
            }
          }
          if(buff.hasOwnProperty("sex")) {
            if(buff.sex != unitData.sex) {
              buff_cnd_flag = false;
            }
          }
          if(buff.hasOwnProperty("elem")) {
            if(buff.elem == 1 && unitData.elem != 1) {
              buff_cnd_flag = false;
            }
            else if(buff.elem == 10 && unitData.elem != 2) {
              buff_cnd_flag = false;
            }
            else if(buff.elem == 100 && unitData.elem != 3) {
              buff_cnd_flag = false;
            }
            else if(buff.elem == 1000 && unitData.elem != 4) {
              buff_cnd_flag = false;
            }
            else if(buff.elem == 10000 && unitData.elem != 5) {
              buff_cnd_flag = false;
            }
            else if(buff.elem == 100000 && unitData.elem != 6) {
              buff_cnd_flag = false;
            }
          }

          if(buff.hasOwnProperty("custom_targets_data")) {
            var arrayLength = buff.custom_targets_data.length;
            for(var c = 0; c < arrayLength; c++) {
              custom_target_flag = true;
              if(buff.custom_targets_data[c].hasOwnProperty("units")) {
                var subArrayLength = buff.custom_targets_data[c].units.length;
                custom_target_flag = false;
                for(var s = 0; s < subArrayLength; s++) {
                  if(buff.custom_targets_data[c].units[s] == unitData.iname) {
                    custom_target_flag = true;
                    break;
                  }
                }
              }
              if(buff.custom_targets_data[c].hasOwnProperty("unit_groups_data")) {
                var subArrayLength = buff.custom_targets_data[c].unit_groups_data.length;
                custom_target_flag = false;
                for(var s = 0; s < subArrayLength; s++) {
                  var subGroupLength = buff.custom_targets_data[c].unit_groups_data[s].units.length;
                  for(var t = 0; t < subGroupLength; t++) {
                    if(buff.custom_targets_data[c].unit_groups_data[s].units[t] == unitData.iname) {
                      custom_target_flag = true;
                      break;
                    }
                  }
                }
              }
              if(buff.custom_targets_data[c].hasOwnProperty("job_groups_data")) {
                var subArrayLength = buff.custom_targets_data[c].job_groups_data.length;
                custom_target_flag = false;
                for(var s = 0; s < subArrayLength; s++) {
                  var subGroupLength = buff.custom_targets_data[c].job_groups_data[s].jobs.length;
                  for(var t = 0; t < subGroupLength; t++) {
                    if(unitData.jobs_data[unitJob].iname == buff.custom_targets_data[c].job_groups_data[s].jobs[t] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == buff.custom_targets_data[c].job_groups_data[s].jobs[t])) {
                      custom_target_flag = true;
                      break;
                    }
                  }
                }
              }
              if(buff.custom_targets_data[c].hasOwnProperty("birth_id")) {
                if(unitData.hasOwnProperty("birth_id") && buff.custom_targets_data[c].birth_id != unitData.birth_id) {
                  custom_target_flag = false;
                }
              }
              if(buff.custom_targets_data[c].hasOwnProperty("fire") && unitData.elem != 1) {
                custom_target_flag = false;
              }
              else if(buff.custom_targets_data[c].hasOwnProperty("water") && unitData.elem != 2) {
                custom_target_flag = false;
              }
              else if(buff.custom_targets_data[c].hasOwnProperty("wind") && unitData.elem != 3) {
                custom_target_flag = false;
              }
              else if(buff.custom_targets_data[c].hasOwnProperty("thunder") && unitData.elem != 4) {
                custom_target_flag = false;
              }
              else if(buff.custom_targets_data[c].hasOwnProperty("shine") && unitData.elem != 5) {
                custom_target_flag = false;
              }
              else if(buff.custom_targets_data[c].hasOwnProperty("dark") && unitData.elem != 6) {
                custom_target_flag = false;
              }
              if(buff.custom_targets_data[c].hasOwnProperty("sex") && buff.custom_targets_data[c].sex != unitData.sex) {
                custom_target_flag = false;
              }
              if(custom_target_flag) {
                break;
              }
            }
          }

          if(cnd_flag && buff_cnd_flag && custom_target_flag) {
            cardSkills.push(cardList[card].data.card_skills[a].card_skill);
            for(var i = 1; i < 12; i++) {
              var type = eval("cardList[" + card + "].data.card_skills[" + a + "].card_skill_data.t_buff_data.type" + i);
              if(type != undefined) {
                var value = 0;
                var min_value = eval("cardList[" + card + "].data.card_skills[" + a + "].card_skill_data.t_buff_data.vini" + i);
                var max_value = eval("cardList[" + card + "].data.card_skills[" + a + "].card_skill_data.t_buff_data.vmax" + i);
                var calc = eval("cardList[" + card + "].data.card_skills[" + a + "].card_skill_data.t_buff_data.calc" + i);
                if(min_value == max_value) {
                  value = min_value;
                }
                else if(cardLevel == maxCardLevel) {
                  value = max_value;
                }
                else {
                  value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / maxCardLevel)) * cardLevel / 100)
                }

                if(calc == 0) {
                  if(type == 48) {
                    addCardGS[25] += value;
                    addCardGS[26] += value;
                    addCardGS[27] += value;
                    addCardGS[28] += value;
                    addCardGS[29] += value;
                    addCardGS[30] += value;
                    addCardGS[31] += value;
                    addCardGS[32] += value;
                    addCardGS[33] += value;
                    addCardGS[34] += value;
                    addCardGS[36] += value;
                    addCardGS[37] += value;
                    addCardGS[41] += value;
                    addCardGS[42] += value;
                    addCardGS[43] += value;
                    addCardGS[45] += value;
                    addCardGS[46] += value;
                    addCardGS[105] += value;
                  }
                  else if(type == 78) {
                    addCardGS[55] += value;
                    addCardGS[56] += value;
                    addCardGS[57] += value;
                    addCardGS[58] += value;
                    addCardGS[59] += value;
                    addCardGS[60] += value;
                    addCardGS[61] += value;
                    addCardGS[62] += value;
                    addCardGS[63] += value;
                    addCardGS[64] += value;
                    addCardGS[66] += value;
                    addCardGS[67] += value;
                    addCardGS[71] += value;
                    addCardGS[73] += value;
                    addCardGS[75] += value;
                    addCardGS[76] += value;
                    addCardGS[106] += value;
                  }
                  else if(type == 153) {
                    var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.card_skills[" + a + "].card_skill_data.t_buff_data.tktag" + i));
                    addCardGSTK[tokkou] += value;
                  }
                  else if(type == 190) {
                    var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.card_skills[" + a + "].card_skill_data.t_buff_data.tktag" + i));
                    addCardGSTK2[tokkou] += value;
                  }
                  else {
                    addCardGS[type] += value;
                  }
                }
              }
            }

            if(cardList[card].data.card_skills[a].hasOwnProperty("add_card_skill_buff_awake_data") && cardLB != 0) {
              for(var i = 1; i < 12; i++) {
                var type = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_awake_data.type" + i);
                if(type != undefined) {
                  var value = 0;
                  var min_value = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_awake_data.vini" + i);
                  var max_value = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_awake_data.vmax" + i);
                  var calc = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_awake_data.calc" + i);
                  if(min_value == max_value) {
                    value = min_value;
                  }
                  else if(cardLB == 5) {
                    value = max_value;
                  }
                  else {
                    value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / 4)) * (parseInt(cardLB) - 1) / 100)
                  }

                  if(calc == 0) {
                    if(type == 48) {
                      addCardGS[25] += value;
                      addCardGS[26] += value;
                      addCardGS[27] += value;
                      addCardGS[28] += value;
                      addCardGS[29] += value;
                      addCardGS[30] += value;
                      addCardGS[31] += value;
                      addCardGS[32] += value;
                      addCardGS[33] += value;
                      addCardGS[34] += value;
                      addCardGS[36] += value;
                      addCardGS[37] += value;
                      addCardGS[41] += value;
                      addCardGS[42] += value;
                      addCardGS[43] += value;
                      addCardGS[45] += value;
                      addCardGS[46] += value;
                      addCardGS[105] += value;
                    }
                    else if(type == 78) {
                      addCardGS[55] += value;
                      addCardGS[56] += value;
                      addCardGS[57] += value;
                      addCardGS[58] += value;
                      addCardGS[59] += value;
                      addCardGS[60] += value;
                      addCardGS[61] += value;
                      addCardGS[62] += value;
                      addCardGS[63] += value;
                      addCardGS[64] += value;
                      addCardGS[66] += value;
                      addCardGS[67] += value;
                      addCardGS[71] += value;
                      addCardGS[73] += value;
                      addCardGS[75] += value;
                      addCardGS[76] += value;
                      addCardGS[106] += value;
                    }
                    else if(type == 153) {
                      var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_awake_data.tktag" + i));
                      addCardGSTK[tokkou] += value;
                    }
                    else if(type == 190) {
                      var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_awake_data.tktag" + i));
                      addCardGSTK2[tokkou] += value;
                    }
                    else {
                      addCardGS[type] += value;
                    }
                  }
                }
              }
            }

            if(cardList[card].data.card_skills[a].hasOwnProperty("add_card_skill_buff_lvmax_data") && cardLB == 5) {
              for(var i = 1; i < 12; i++) {
                var type = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_lvmax_data.type" + i);
                if(type != undefined) {
                  var value = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_lvmax_data.vini" + i);
                  var calc = eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_lvmax_data.calc" + i);

                  if(calc == 0) {
                    if(type == 48) {
                      addCardGS[25] += value;
                      addCardGS[26] += value;
                      addCardGS[27] += value;
                      addCardGS[28] += value;
                      addCardGS[29] += value;
                      addCardGS[30] += value;
                      addCardGS[31] += value;
                      addCardGS[32] += value;
                      addCardGS[33] += value;
                      addCardGS[34] += value;
                      addCardGS[36] += value;
                      addCardGS[37] += value;
                      addCardGS[41] += value;
                      addCardGS[42] += value;
                      addCardGS[43] += value;
                      addCardGS[45] += value;
                      addCardGS[46] += value;
                      addCardGS[105] += value;
                    }
                    else if(type == 78) {
                      addCardGS[55] += value;
                      addCardGS[56] += value;
                      addCardGS[57] += value;
                      addCardGS[58] += value;
                      addCardGS[59] += value;
                      addCardGS[60] += value;
                      addCardGS[61] += value;
                      addCardGS[62] += value;
                      addCardGS[63] += value;
                      addCardGS[64] += value;
                      addCardGS[66] += value;
                      addCardGS[67] += value;
                      addCardGS[71] += value;
                      addCardGS[73] += value;
                      addCardGS[75] += value;
                      addCardGS[76] += value;
                      addCardGS[106] += value;
                    }
                    else if(type == 153) {
                      var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_lvmax_data.tktag" + i));
                      addCardGSTK[tokkou] += value;
                    }
                    else if(type == 190) {
                      var tokkou = tkTags.indexOf(eval("cardList[" + card + "].data.card_skills[" + a + "].add_card_skill_buff_lvmax_data.tktag" + i));
                      addCardGSTK2[tokkou] += value;
                    }
                    else {
                      addCardGS[type] += value;
                    }
                  }
                }
              }
            }
          }
        }

        if(g != 0) {
          for(var i = 0; i < statTypes.length; i++) {
            value = Math.trunc(addCardGS[i] * subM[cardLB]);
            if(addTempCardGS[i] > value || value < 0 || value == 0) {
              if(value < 0) {
                if([83, 94, 95, 99, 122, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175].includes(i)) {
                  if(addTempCardGS[i] < value) {
                    addCardGS[i] = addTempCardGS[i];
                  }
                  else {
                    addCardGS[i] = value;
                  }
                }
              }
              else {
                addCardGS[i] = addTempCardGS[i];
              }
            }
            else {
              addCardGS[i] = value;
            }
          }
          for(var i = 0; i < tokkouTypes.length; i++) {
            value = Math.trunc(addCardGSTK[i] * subM[cardLB]);
            if(addTempCardGSTK[i] > value) {
              addCardGSTK[i] = addTempCardGSTK[i];
            }
            else {
              addCardGSTK[i] = value;
            }
          }
          for(var i = 0; i < tokkouTypes.length; i++) {
            value = Math.trunc(addCardGSTK2[i] * subM[cardLB]);
            if(addTempCardGSTK2[i] > value) {
              addCardGSTK2[i] = addTempCardGSTK2[i];
            }
            else {
              addCardGSTK2[i] = value;
            }
          }
        }

      }

      if(cardList[card].data.hasOwnProperty("abilities")) {
        var abilCount = cardList[card].data.abilities.length;

        for(var a = 0; a < abilCount; a++) {
          if(cardList[card].data.abilities[a].hasOwnProperty("abil_lvmax_data") && cardLB == 5) {
            var ability = cardList[card].data.abilities[a].abil_lvmax_data;
          }
          else {
            var ability = cardList[card].data.abilities[a].abil_data;
          }
          if((ability.skl1_data.timing != 1 && ability.skl1_data.timing != 8) || ability.skl1_data.hasOwnProperty("cond") || (!ability.skl1_data.hasOwnProperty("t_buff_data") && !ability.skl1_data.hasOwnProperty("s_buff_data")) || ((!ability.skl1_data.hasOwnProperty("t_buff_data") || ability.skl1_data.hasOwnProperty("t_buff_data") && (ability.skl1_data.t_buff_data.timing != 1 || ability.skl1_data.t_buff_data.hasOwnProperty("vone1") || ability.skl1_data.t_buff_data.hasOwnProperty("app_mct"))) && (!ability.skl1_data.hasOwnProperty("s_buff_data") || ability.skl1_data.hasOwnProperty("s_buff_data") && (ability.skl1_data.s_buff_data.timing != 1 || ability.skl1_data.s_buff_data.hasOwnProperty("vone1") || ability.skl1_data.s_buff_data.hasOwnProperty("app_mct"))))) {
            continue;
          }

          var cnd_flag = true;

          if(cardList[card].data.abilities[a].hasOwnProperty("cnds_data")) {
            var skill = cardList[card].data.abilities[a].cnds_data;
            if(skill.hasOwnProperty("birth_id")) {
              var arrayLength = skill.birth_id.length;
              cnd_flag = false;
              for(var c = 0; c < arrayLength; c++) {
                if(unitData.hasOwnProperty("birth_id") && skill.birth_id[c] == unitData.birth_id) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(skill.hasOwnProperty("el_fire") || skill.hasOwnProperty("el_watr") || skill.hasOwnProperty("el_wind") || skill.hasOwnProperty("el_thdr") || skill.hasOwnProperty("el_lit") || skill.hasOwnProperty("el_drk")) {
              cnd_flag = false;
              if(skill.hasOwnProperty("el_fire")) {
                if(unitData.elem == 1) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_watr")) {
                if(unitData.elem == 2) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_wind")) {
                if(unitData.elem == 3) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_thdr")) {
                if(unitData.elem == 4) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_lit")) {
                if(unitData.elem == 5) {
                  cnd_flag = true;
                }
              }
              if(skill.hasOwnProperty("el_drk")) {
                if(unitData.elem == 6) {
                  cnd_flag = true;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(skill.hasOwnProperty("sex")) {
              if(skill.sex != unitData.sex) {
                cnd_flag = false;
                continue;
              }
            }
            if(skill.hasOwnProperty("unit_group_data")) {
              var arrayLength = skill.unit_group_data.units.length;
              cnd_flag = false;
              for(var c = 0; c < arrayLength; c++) {
                if(skill.unit_group_data.units[c] == unitData.iname) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
            if(skill.hasOwnProperty("job_group_data")) {
              var arrayLength = skill.job_group_data.jobs.length;
              cnd_flag = false;
              for(var c = 0; c < arrayLength; c++) {
                if(unitData.jobs_data[unitJob].iname == skill.job_group_data.jobs[c] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == skill.job_group_data.jobs[c])) {
                  cnd_flag = true;
                  break;
                }
              }
              if(!cnd_flag) {
                continue;
              }
            }
          }

          if(cnd_flag) {
            if((ability.skl1_data.timing == 1 || ability.skl1_data.timing == 8) && !ability.skl1_data.hasOwnProperty("cond") && ability.skl1_data.hasOwnProperty("t_buff_data") && ability.skl1_data.t_buff_data.timing == 1 && !ability.skl1_data.t_buff_data.hasOwnProperty("vone1") && !ability.skl1_data.t_buff_data.hasOwnProperty("app_mct")) {
              for(var i = 1; i < 12; i++) {
                var type = eval("ability.skl1_data.t_buff_data.type" + i);
                if(type != undefined) {
                  var value = 0;
                  var min_value = eval("ability.skl1_data.t_buff_data.vini" + i);
                  var max_value = eval("ability.skl1_data.t_buff_data.vmax" + i);
                  var calc = eval("ability.skl1_data.t_buff_data.calc" + i);
                  if(min_value == max_value) {
                    value = min_value;
                  }
                  else if(cardLevel == maxCardLevel) {
                    value = max_value;
                  }
                  else {
                    value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / maxCardLevel)) * cardLevel / 100)
                  }

                  if(g != 0 && (cardList[card].data.abilities[a].hasOwnProperty("is_decrease_eff") && cardList[card].data.abilities[a].is_decrease_eff == 1)) {
                    value = Math.trunc(value * subM[cardLB]);
                  }

                  if(calc == 0) {
                    if(type == 48) {
                      addCA[25] += value;
                      addCA[26] += value;
                      addCA[27] += value;
                      addCA[28] += value;
                      addCA[29] += value;
                      addCA[30] += value;
                      addCA[31] += value;
                      addCA[32] += value;
                      addCA[33] += value;
                      addCA[34] += value;
                      addCA[36] += value;
                      addCA[37] += value;
                      addCA[41] += value;
                      addCA[42] += value;
                      addCA[43] += value;
                      addCA[45] += value;
                      addCA[46] += value;
                      addCA[105] += value;
                    }
                    else if(type == 78) {
                      addCA[55] += value;
                      addCA[56] += value;
                      addCA[57] += value;
                      addCA[58] += value;
                      addCA[59] += value;
                      addCA[60] += value;
                      addCA[61] += value;
                      addCA[62] += value;
                      addCA[63] += value;
                      addCA[64] += value;
                      addCA[66] += value;
                      addCA[67] += value;
                      addCA[71] += value;
                      addCA[73] += value;
                      addCA[75] += value;
                      addCA[76] += value;
                      addCA[106] += value;
                    }
                    else if(type == 153) {
                      var tokkou = tkTags.indexOf(eval("ability.skl1_data.t_buff_data.tktag" + i));
                      addCATK[tokkou] += value;
                    }
                    else if(type == 190) {
                      var tokkou = tkTags.indexOf(eval("ability.skl1_data.t_buff_data.tktag" + i));
                      addCATK2[tokkou] += value;
                    }
                    else {
                      addCA[type] += value;
                    }
                  }
                  else if(calc == 1 && (scaleCA[type] < value)) {
                    scaleCA[type] = value;
                  }
                }
              }
            }
            if((ability.skl1_data.timing == 1 || ability.skl1_data.timing == 8) && !ability.skl1_data.hasOwnProperty("cond") && ability.skl1_data.hasOwnProperty("s_buff_data") && ability.skl1_data.s_buff_data.timing == 1 && !ability.skl1_data.s_buff_data.hasOwnProperty("vone1") && !ability.skl1_data.s_buff_data.hasOwnProperty("app_mct")) {
              for(var i = 1; i < 12; i++) {
                var type = eval("ability.skl1_data.s_buff_data.type" + i);
                if(type != undefined) {
                  var value = 0;
                  var min_value = eval("ability.skl1_data.s_buff_data.vini" + i);
                  var max_value = eval("ability.skl1_data.s_buff_data.vmax" + i);
                  var calc = eval("ability.skl1_data.s_buff_data.calc" + i);
                  if(min_value == max_value) {
                    value = min_value;
                  }
                  else if(cardLevel == maxCardLevel) {
                    value = max_value;
                  }
                  else {
                    value = Math.trunc(min_value + Math.trunc(((max_value - min_value) * 100 / maxCardLevel)) * cardLevel / 100)
                  }

                  if(g != 0 && (cardList[card].data.abilities[a].hasOwnProperty("is_decrease_eff") && cardList[card].data.abilities[a].is_decrease_eff == 1)) {
                    value = Math.trunc(value * subM[cardLB]);
                  }

                  if(calc == 0) {
                    if(type == 48) {
                      addCA[25] += value;
                      addCA[26] += value;
                      addCA[27] += value;
                      addCA[28] += value;
                      addCA[29] += value;
                      addCA[30] += value;
                      addCA[31] += value;
                      addCA[32] += value;
                      addCA[33] += value;
                      addCA[34] += value;
                      addCA[36] += value;
                      addCA[37] += value;
                      addCA[41] += value;
                      addCA[42] += value;
                      addCA[43] += value;
                      addCA[45] += value;
                      addCA[46] += value;
                      addCA[105] += value;
                    }
                    else if(type == 78) {
                      addCA[55] += value;
                      addCA[56] += value;
                      addCA[57] += value;
                      addCA[58] += value;
                      addCA[59] += value;
                      addCA[60] += value;
                      addCA[61] += value;
                      addCA[62] += value;
                      addCA[63] += value;
                      addCA[64] += value;
                      addCA[66] += value;
                      addCA[67] += value;
                      addCA[71] += value;
                      addCA[73] += value;
                      addCA[75] += value;
                      addCA[76] += value;
                      addCA[106] += value;
                    }
                    else if(type == 153) {
                      var tokkou = tkTags.indexOf(eval("ability.skl1_data.s_buff_data.tktag" + i));
                      addCATK[tokkou] += value;
                    }
                    else if(type == 190) {
                      var tokkou = tkTags.indexOf(eval("ability.skl1_data.s_buff_data.tktag" + i));
                      addCATK2[tokkou] += value;
                    }
                    else {
                      addCA[type] += value;
                    }
                  }
                  else if(calc == 1 && (scaleCA[type] < value)) {
                    scaleCA[type] = value;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

function updateRune() {
  var runes = document.getElementById("runes").querySelectorAll(".rune-icon");

  addRune = Array(statTypes.length).fill(0);
  scaleRune = Array(statTypes.length).fill(0);
  var setTypes = Array(14).fill(0);

  for(var g = 0; g < runes.length; g++) {
    if(runes[g].hasAttribute("data-rune-id")) {
      var rune = runes[g].getAttribute("data-rune-id");
      var enhancement = parseInt(runes[g].getAttribute("data-enhancement"));

      var statVal = runes[g].getAttribute("data-base-stat").split(",");
      if(runeList[rune].data.hasOwnProperty("base_state_data") && statVal[0] != 0) {
        var baseState = runeList[rune].data.base_state_data.lottery_state_data;
        var baseStateLength = baseState.length;
        var type = parseInt(statVal[0]);
        var value = parseInt(statVal[1]);
        for(var i = 0; i < baseStateLength; i++) {
          if(type == baseState[i].base_state_data.type) {
            var calc = baseState[i].base_state_data.calc;
            if(enhancement != 0) {
              value += baseState[i].base_state_data.enh_param[enhancement-1];
            }
            if(calc == 0) {
              if(type == 48) {
                addRune[25] += value;
                addRune[26] += value;
                addRune[27] += value;
                addRune[28] += value;
                addRune[29] += value;
                addRune[30] += value;
                addRune[31] += value;
                addRune[32] += value;
                addRune[33] += value;
                addRune[34] += value;
                addRune[36] += value;
                addRune[37] += value;
                addRune[41] += value;
                addRune[42] += value;
                addRune[43] += value;
                addRune[45] += value;
                addRune[46] += value;
                addRune[105] += value;
              }
              else if(type == 78) {
                addRune[55] += value;
                addRune[56] += value;
                addRune[57] += value;
                addRune[58] += value;
                addRune[59] += value;
                addRune[60] += value;
                addRune[61] += value;
                addRune[62] += value;
                addRune[63] += value;
                addRune[64] += value;
                addRune[66] += value;
                addRune[67] += value;
                addRune[71] += value;
                addRune[73] += value;
                addRune[75] += value;
                addRune[76] += value;
                addRune[106] += value;
              }
              else {
                addRune[type] += value;
              }
            }
            else if(calc == 1) {
              scaleRune[type] += value;
            }
            break;
          }
        }
      }

      var statVal = runes[g].getAttribute("data-evo-stat").split(",");
      if(runeList[rune].data.hasOwnProperty("evo_state_data") && (statVal[0] != 0 || statVal[2] != 0 || statVal[4] != 0)) {
        var evoState = runeList[rune].data.evo_state_data.lottery_state_data;
        var evoStateLength = evoState.length;
        for(var i = 0; i < evoStateLength; i++) {
          var calc = evoState[i].base_state_data.calc;
          var offSet = 0;
          for(var x = 0; x < 3; x++) {
            var type = 0;
            var value = 0;
            if(statVal[offSet] == evoState[i].base_state_data.type) {
              type = parseInt(statVal[offSet]);
              value = parseInt(statVal[offSet+1]);
            }
            if(type != 0) {
              if(calc == 0) {
                if(type == 48) {
                  addRune[25] += value;
                  addRune[26] += value;
                  addRune[27] += value;
                  addRune[28] += value;
                  addRune[29] += value;
                  addRune[30] += value;
                  addRune[31] += value;
                  addRune[32] += value;
                  addRune[33] += value;
                  addRune[34] += value;
                  addRune[36] += value;
                  addRune[37] += value;
                  addRune[41] += value;
                  addRune[42] += value;
                  addRune[43] += value;
                  addRune[45] += value;
                  addRune[46] += value;
                  addRune[105] += value;
                }
                else if(type == 78) {
                  addRune[55] += value;
                  addRune[56] += value;
                  addRune[57] += value;
                  addRune[58] += value;
                  addRune[59] += value;
                  addRune[60] += value;
                  addRune[61] += value;
                  addRune[62] += value;
                  addRune[63] += value;
                  addRune[64] += value;
                  addRune[66] += value;
                  addRune[67] += value;
                  addRune[71] += value;
                  addRune[73] += value;
                  addRune[75] += value;
                  addRune[76] += value;
                  addRune[106] += value;
                }
                else {
                  addRune[type] += value;
                }
              }
              else if(calc == 1) {
                scaleRune[type] += value;
              }
            }
            offSet += 2;
          }
        }
      }

      setTypes[runeList[rune].data.seteff_type] += 1;
      if(runeList[rune].data.hasOwnProperty("seteff_type_data")) {
        if(setTypes[runeList[rune].data.seteff_type] == runeList[rune].data.seteff_type_data.cost) {
          var statsLength = runeList[rune].data.seteff_type_data.state.length;
          for(i = 0; i < statsLength; i++) {
            var type = runeList[rune].data.seteff_type_data.state[i].type;
            var value = runeList[rune].data.seteff_type_data.state[i].vone;
            var calc = runeList[rune].data.seteff_type_data.state[i].calc;
            if(calc == 0) {
              if(type == 48) {
                addRune[25] += value;
                addRune[26] += value;
                addRune[27] += value;
                addRune[28] += value;
                addRune[29] += value;
                addRune[30] += value;
                addRune[31] += value;
                addRune[32] += value;
                addRune[33] += value;
                addRune[34] += value;
                addRune[36] += value;
                addRune[37] += value;
                addRune[41] += value;
                addRune[42] += value;
                addRune[43] += value;
                addRune[45] += value;
                addRune[46] += value;
                addRune[105] += value;
              }
              else if(type == 78) {
                addRune[55] += value;
                addRune[56] += value;
                addRune[57] += value;
                addRune[58] += value;
                addRune[59] += value;
                addRune[60] += value;
                addRune[61] += value;
                addRune[62] += value;
                addRune[63] += value;
                addRune[64] += value;
                addRune[66] += value;
                addRune[67] += value;
                addRune[71] += value;
                addRune[73] += value;
                addRune[75] += value;
                addRune[76] += value;
                addRune[106] += value;
              }
              else {
                addRune[type] += value;
              }
            }
            else if(calc == 1) {
              scaleRune[type] += value;
            }
          }
          setTypes[runeList[rune].data.seteff_type] = 0;
        }
      }
    }
  }
}

function updateCrystal() {
  addCrystal = Array(statTypes.length).fill(0);
  addLimit = Array(statTypes.length).fill(0);
  addCrystalTK = Array(tokkouTypes.length).fill(0);
  addCrystalTK2 = Array(tokkouTypes.length).fill(0);

  if(locale != "jp") {
    return;
  }

  var crystals = document.getElementById("crystals").querySelectorAll(".crystal-icon");
  var activeCrystals = [];
  var activeSets = [];

  for(var g = 0; g < crystals.length; g++) {
    if(crystals[g].hasAttribute("data-crystal-id")) {
      var crystalDict = {};
      var crystal = crystals[g].getAttribute("data-crystal-id");
      var slot = crystals[g].getAttribute("data-slot");
      if(crystalList[crystal] != null) {
        crystalDict["iname"] = crystalList[crystal].data.iname;
        crystalDict["rank"] = crystals[g].getAttribute("data-rank-id");
        if(slot == 1) {
          crystalDict["type"] = 0;
        }
        else {
          crystalDict["type"] = 1;
        }
        activeCrystals.push(crystalDict);
      }
    }
  }

  for(var g = 0; g < crystals.length; g++) {
    if(crystals[g].hasAttribute("data-crystal-id")) {
      var crystal = crystals[g].getAttribute("data-crystal-id");
      var crystalRank = crystals[g].getAttribute("data-rank-id");

      if(crystalList[crystal].data.hasOwnProperty("equip_effect_" + crystalRanks[crystalRank] + "_data")) {
        for(var i = 1; i < 12; i++) {
          var type = eval("crystalList[" + crystal + "].data.equip_effect_" + crystalRanks[crystalRank] + "_data.t_buff_data.type" + i);
          if(type != undefined) {
            var value = eval("crystalList[" + crystal + "].data.equip_effect_" + crystalRanks[crystalRank] + "_data.t_buff_data.vmax" + i);
            var calc = eval("crystalList[" + crystal + "].data.equip_effect_" + crystalRanks[crystalRank] + "_data.t_buff_data.calc" + i);

            if(g != 0) {
              value = Math.trunc(value * subC[crystalRank]);
            }

            if(calc == 0) {
              if(type == 48) {
                addCrystal[25] += value;
                addCrystal[26] += value;
                addCrystal[27] += value;
                addCrystal[28] += value;
                addCrystal[29] += value;
                addCrystal[30] += value;
                addCrystal[31] += value;
                addCrystal[32] += value;
                addCrystal[33] += value;
                addCrystal[34] += value;
                addCrystal[36] += value;
                addCrystal[37] += value;
                addCrystal[41] += value;
                addCrystal[42] += value;
                addCrystal[43] += value;
                addCrystal[45] += value;
                addCrystal[46] += value;
                addCrystal[105] += value;
              }
              else if(type == 78) {
                addCrystal[55] += value;
                addCrystal[56] += value;
                addCrystal[57] += value;
                addCrystal[58] += value;
                addCrystal[59] += value;
                addCrystal[60] += value;
                addCrystal[61] += value;
                addCrystal[62] += value;
                addCrystal[63] += value;
                addCrystal[64] += value;
                addCrystal[66] += value;
                addCrystal[67] += value;
                addCrystal[71] += value;
                addCrystal[73] += value;
                addCrystal[75] += value;
                addCrystal[76] += value;
                addCrystal[106] += value;
              }
              else if(type == 153) {
                var tokkou = tkTags.indexOf(eval("crystalList[" + crystal + "].data.equip_effect_" + crystalRanks[crystalRank] + "_data.t_buff_data.tktag" + i));
                addCrystalTK[tokkou] += value;
              }
              else if(type == 190) {
                var tokkou = tkTags.indexOf(eval("crystalList[" + crystal + "].data.equip_effect_" + crystalRanks[crystalRank] + "_data.t_buff_data.tktag" + i));
                addCrystalTK2[tokkou] += value;
              }
              else {
                addCrystal[type] += value;
              }
            }
          }
        }
      }

      if(crystalList[crystal].data.hasOwnProperty("crystal_sets")) {

        for(var a = 0; a < crystalList[crystal].data.crystal_sets.length; a++) {
          var mainFlag = false;
          var subFlag = false;
          var subCount = 0;
          var setRank = 0;

          for(var b = 0; b < activeCrystals.length; b++) {
            if(activeCrystals[b].iname == crystalList[crystal].data.crystal_sets[a].main_crystal && activeCrystals[b].type == 0) {
              mainFlag = true;
              setRank = activeCrystals[b].rank;
              break;
            }
          }

          for(var b = 0; b < crystalList[crystal].data.crystal_sets[a].sub_crystals.length; b++) {
            for(var c = 0; c < activeCrystals.length; c++) {
              if(activeCrystals[c].iname == crystalList[crystal].data.crystal_sets[a].sub_crystals[b] && activeCrystals[c].type == 1) {
                subCount += 1;
                break;
              }
            }
          }

          if(subCount == crystalList[crystal].data.crystal_sets[a].sub_crystals.length) {
            subFlag = true;
          }

          if(mainFlag && subFlag && !activeSets.includes(crystalList[crystal].data.crystal_sets[a].iname)) {
            activeSets.push(crystalList[crystal].data.crystal_sets[a].iname);
            if(crystalList[crystal].data.crystal_sets[a].hasOwnProperty("buff_iname_data")) {
              var buff = crystalList[crystal].data.crystal_sets[a].buff_iname_data;
              for(var i = 1; i < 12; i++) {
                var type = eval("buff.type" + i);
                if(type != undefined) {
                  var value = eval("buff.vmax" + i);
                  var calc = eval("buff.calc" + i);

                  value = Math.trunc(value * crystalSet[setRank]);

                  if(calc == 0) {
                    if(type == 48) {
                      addCrystal[25] += value;
                      addCrystal[26] += value;
                      addCrystal[27] += value;
                      addCrystal[28] += value;
                      addCrystal[29] += value;
                      addCrystal[30] += value;
                      addCrystal[31] += value;
                      addCrystal[32] += value;
                      addCrystal[33] += value;
                      addCrystal[34] += value;
                      addCrystal[36] += value;
                      addCrystal[37] += value;
                      addCrystal[41] += value;
                      addCrystal[42] += value;
                      addCrystal[43] += value;
                      addCrystal[45] += value;
                      addCrystal[46] += value;
                      addCrystal[105] += value;
                    }
                    else if(type == 78) {
                      addCrystal[55] += value;
                      addCrystal[56] += value;
                      addCrystal[57] += value;
                      addCrystal[58] += value;
                      addCrystal[59] += value;
                      addCrystal[60] += value;
                      addCrystal[61] += value;
                      addCrystal[62] += value;
                      addCrystal[63] += value;
                      addCrystal[64] += value;
                      addCrystal[66] += value;
                      addCrystal[67] += value;
                      addCrystal[71] += value;
                      addCrystal[73] += value;
                      addCrystal[75] += value;
                      addCrystal[76] += value;
                      addCrystal[106] += value;
                    }
                    else if(type == 153) {
                      var tokkou = tkTags.indexOf(eval("buff.tktag" + i));
                      addCrystalTK[tokkou] += value;
                    }
                    else if(type == 190) {
                      var tokkou = tkTags.indexOf(eval("buff.tktag" + i));
                      addCrystalTK2[tokkou] += value;
                    }
                    else {
                      addCrystal[type] += value;
                    }
                  }
                }
              }
            }
            if(crystalList[crystal].data.crystal_sets[a].hasOwnProperty("add_limit_data")) {
              var buff = crystalList[crystal].data.crystal_sets[a].add_limit_data;

              for(var i = 0; i < buff.limit_up_params.length; i++) {
                var type = eval("buff.limit_up_params[" + i + "].type");
                if(type != undefined) {
                  var value = eval("buff.limit_up_params[" + i + "].value");
                  var calc = eval("buff.limit_up_params[" + i + "].calc");

                  value = Math.trunc(value * crystalSet[setRank]);
                
                  if(calc == 0) {
                    if(type == 48) {
                      addLimit[25] += value;
                      addLimit[26] += value;
                      addLimit[27] += value;
                      addLimit[28] += value;
                      addLimit[29] += value;
                      addLimit[30] += value;
                      addLimit[31] += value;
                      addLimit[32] += value;
                      addLimit[33] += value;
                      addLimit[34] += value;
                      addLimit[36] += value;
                      addLimit[37] += value;
                      addLimit[41] += value;
                      addLimit[42] += value;
                      addLimit[43] += value;
                      addLimit[45] += value;
                      addLimit[46] += value;
                      addLimit[105] += value;
                    }
                    else if(type == 78) {
                      addLimit[55] += value;
                      addLimit[56] += value;
                      addLimit[57] += value;
                      addLimit[58] += value;
                      addLimit[59] += value;
                      addLimit[60] += value;
                      addLimit[61] += value;
                      addLimit[62] += value;
                      addLimit[63] += value;
                      addLimit[64] += value;
                      addLimit[66] += value;
                      addLimit[67] += value;
                      addLimit[71] += value;
                      addLimit[73] += value;
                      addLimit[75] += value;
                      addLimit[76] += value;
                      addLimit[106] += value;
                    }
                    else {
                      addLimit[type] += value;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

function updateStats() {
  if(locale == "jp") {
    for(var i = 0; i < addCrystal.length; i++) {
      if(addCrystal[i] > (statLimits[i] + addLimit[i])) {
        addCrystal[i] = (statLimits[i] + addLimit[i]);
      }
    }
  }
  var hp = addStats[1] + addSkills[1] + addMA[1] + addCard[1] + addEN[1] + addJM[1] + addStats[2] + addSkills[2] + addMA[2] + addCard[2] + addEN[2] + addJM[2] + addRune[1] + addRune[2] + addTE[1] + addTE[2] + addBond[1] + addBond[2] + addEXP[1] + addEXP[2];
  if(addGear[1] > addGear[2]) {
    hp += addGear[1];
  }
  else {
    hp += addGear[2];
  }
  if(subGear[1] > subGear[2]) {
    hp += subGear[1];
  }
  else {
    hp += subGear[2];
  }
  var mp = addStats[3] + addSkills[3] + addGear[3] + addMA[3] + addCard[3] + addEN[3] + addJM[3] + subGear[3] + addRune[3] + addTE[3] + addBond[3] + addEXP[3];
  var atk = addStats[5] + addSkills[5] + addGear[5] + addMA[5] + addCard[5] + addEN[5] + addJM[5] + subGear[5] + addRune[5] + addTE[5] + addBond[5] + addEXP[5];
  var def = addStats[6] + addSkills[6] + addGear[6] + addMA[6] + addCard[6] + addEN[6] + addJM[6] + subGear[6] + addRune[6] + addTE[6] + addBond[6] + addEXP[6];
  var mag = addStats[7] + addSkills[7] + addGear[7] + addMA[7] + addCard[7] + addEN[7] + addJM[7] + subGear[7] + addRune[7] + addTE[7] + addBond[7] + addEXP[7];
  var mnd = addStats[8] + addSkills[8] + addGear[8] + addMA[8] + addCard[8] + addEN[8] + addJM[8] + subGear[8] + addRune[8] + addTE[8] + addBond[8] + addEXP[8];
  var dex = addStats[10] + addSkills[10] + addGear[10] + addMA[10] + addCard[10] + addEN[10] + addJM[10] + subGear[10] + addRune[10] + addTE[10] + addBond[10] + addEXP[10];
  var spd = addStats[11] + addSkills[11] + addGear[11] + addMA[11] + addCard[11] + addEN[11] + addJM[11] + subGear[11] + addRune[11] + addTE[11] + addBond[11] + addEXP[11];
  var cri = addStats[12] + addSkills[12] + addGear[12] + addMA[12] + addCard[12] + addEN[12] + addJM[12] + subGear[12] + addRune[12] + addTE[12] + addBond[12] + addEXP[12];
  var luk = addStats[13] + addSkills[13] + addGear[13] + addMA[13] + addCard[13] + addEN[13] + addJM[13] + subGear[13] + addRune[13] + addTE[13] + addBond[13] + addEXP[13];
  var imp = addStats[4] + addSkills[4] + addGear[4] + addMA[4] + addCard[4] + addEN[4] + addJM[4] + subGear[4] + addRune[4] + addTE[4] + addBond[4] + addEXP[4] + addCrystal[4];
  var imp_map = addCardGS[4] + addGA[4] + addCA[4];
  imp = imp + imp_map;
  var move = addStats[14] + addSkills[14] + addGear[14] + addMA[14] + addCard[14] + addEN[14] + addJM[14] + subGear[14] + addRune[14] + addTE[14] + addBond[14] + addEXP[14] + addCrystal[14];
  var move_map = addCardGS[14] + addGA[14] + addCA[14];
  move = move + move_map;
  var jmp = addStats[15] + addSkills[15] + addGear[15] + addMA[15] + addCard[15] + addEN[15] + addJM[15] + subGear[15] + addRune[15] + addTE[15] + addBond[15] + addEXP[15] + addCrystal[15];
  var jmp_map = addCardGS[15] + addGA[15] + addCA[15];
  jmp = jmp + jmp_map;
  var healing = addStats[9] + addSkills[9] + addGear[9] + addMA[9] + addCard[9] + addEN[9] + addJM[9] + subGear[9] + addRune[9] + addTE[9] + addBond[9] + addEXP[9];

  scaleBA = Array(statTypes.length).fill(0);
  for(a = 1; a < 14; a++) {
    if(a != 4) {
      if(scaleGA[a] != 0) {
        scaleBA[a] = scaleGA[a];
      }
      if(scaleCA[a] != 0 && scaleBA[a] < scaleCA[a]) {
        scaleBA[a] = scaleCA[a];
      }
    }
  }
  if(scaleBA[1] > scaleBA[2]) {
    scaleBA[2] = 0;
  }
  else {
    scaleBA[1] = 0;
  }

  var cp = 0;

  hp = Math.trunc((hp) + Math.trunc((hp) * ((scaleSkills[1] + scaleJM[1] + scaleEN[1] + scaleMA[1] + scaleGear[1] + scaleSkills[2] + scaleJM[2] + scaleEN[2] + scaleMA[2] + scaleGear[2] + scaleRune[1] + scaleRune[2] + scaleTE[1] + scaleTE[2] + scaleBond[1] + scaleBond[2] + scaleEXP[1] + scaleEXP[2])/100)));
  cp += Math.trunc(hp / 10);
  var hp_map = addCardGS[1] + addGA[1] + addCA[1] + addCardGS[2] + addGA[2] + addCA[2];
  hp_map = Math.trunc((hp_map) + Math.trunc((hp + hp_map + addCrystal[2]) * ((scaleBA[1] + scaleBA[2])/100)));
  hp = hp + hp_map + addCrystal[2];

  mp = Math.trunc((mp) + Math.trunc((mp) * ((scaleSkills[3] + scaleJM[3] + scaleEN[3] + scaleMA[3] + scaleGear[3] + scaleRune[3] + scaleTE[3] + scaleBond[3] + scaleEXP[3])/100)));
  var mp_map = addCardGS[3] + addGA[3] + addCA[3];
  var stat_mp = mp + addCardGS[3];
  mp_map = Math.trunc((mp_map) + Math.trunc((mp + mp_map + addCrystal[3]) * ((scaleBA[3])/100)));
  mp = mp + mp_map + addCrystal[3];

  atk = Math.trunc((atk) + Math.trunc((atk) * ((scaleSkills[5] + scaleJM[5] + scaleEN[5] + scaleMA[5] + scaleGear[5] + scaleRune[5] + scaleTE[5] + scaleBond[5] + scaleEXP[5])/100)));
  cp += atk;
  var atk_map = addCardGS[5] + addGA[5] + addCA[5];
  atk_map = Math.trunc((atk_map) + Math.trunc((atk + atk_map + addCrystal[5]) * ((scaleBA[5])/100)));
  atk = atk + atk_map + addCrystal[5];

  def = Math.trunc((def) + Math.trunc((def) * ((scaleSkills[6] + scaleJM[6] + scaleEN[6] + scaleMA[6] + scaleGear[6] + scaleRune[6] + scaleTE[6] + scaleBond[6] + scaleEXP[6])/100)));
  cp += def;
  var def_map = addCardGS[6] + addGA[6] + addCA[6];
  def_map = Math.trunc((def_map) + Math.trunc((def + def_map + addCrystal[6]) * ((scaleBA[6])/100)));
  def = def + def_map + addCrystal[6];

  mag = Math.trunc((mag) + Math.trunc((mag) * ((scaleSkills[7] + scaleJM[7] + scaleEN[7] + scaleMA[7] + scaleGear[7] + scaleRune[7] + scaleTE[7] + scaleBond[7] + scaleEXP[7])/100)));
  cp += mag;
  var mag_map = addCardGS[7] + addGA[7] + addCA[7];
  mag_map = Math.trunc((mag_map) + Math.trunc((mag + mag_map + addCrystal[7]) * ((scaleBA[7])/100)));
  mag = mag + mag_map + addCrystal[7];

  mnd = Math.trunc((mnd) + Math.trunc((mnd) * ((scaleSkills[8] + scaleJM[8] + scaleEN[8] + scaleMA[8] + scaleGear[8] + scaleRune[8] + scaleTE[8] + scaleBond[8] + scaleEXP[8])/100)));
  cp += mnd;
  var mnd_map = addCardGS[8] + addGA[8] + addCA[8];
  mnd_map = Math.trunc((mnd_map) + Math.trunc((mnd + mnd_map + addCrystal[8]) * ((scaleBA[8])/100)));
  mnd = mnd + mnd_map + addCrystal[8];

  dex = Math.trunc((dex) + Math.trunc((dex) * ((scaleSkills[10] + scaleJM[10] + scaleEN[10] + scaleMA[10] + scaleGear[10] + scaleRune[10] + scaleTE[10] + scaleBond[10] + scaleEXP[10])/100)));
  cp += dex;
  var dex_map = addCardGS[10] + addGA[10] + addCA[10];
  dex_map = Math.trunc((dex_map) + Math.trunc((dex + dex_map + addCrystal[10]) * ((scaleBA[10])/100)));
  dex = dex + dex_map + addCrystal[10];

  spd = Math.trunc((spd) + Math.trunc((spd) * ((scaleSkills[11] + scaleJM[11] + scaleEN[11] + scaleMA[11] + scaleGear[11] + scaleRune[11] + scaleTE[11] + scaleBond[11] + scaleEXP[11])/100)));
  cp += spd * 5;
  var spd_map = addCardGS[11] + addGA[11] + addCA[11];
  spd_map = Math.trunc((spd_map) + Math.trunc((spd + spd_map + addCrystal[11]) * ((scaleBA[11])/100)));
  spd = spd + spd_map + addCrystal[11];

  cri = Math.trunc((cri) + Math.trunc((cri) * ((scaleSkills[12] + scaleJM[12] + scaleEN[12] + scaleMA[12] + scaleGear[12] + scaleRune[12] + scaleTE[12] + scaleBond[12] + scaleEXP[12])/100)));
  cp += cri;
  var cri_map = addCardGS[12] + addGA[12] + addCA[12];
  cri_map = Math.trunc((cri_map) + Math.trunc((cri + cri_map + addCrystal[12]) * ((scaleBA[12])/100)));
  cri = cri + cri_map + addCrystal[12];

  luk = Math.trunc((luk) + Math.trunc((luk) * ((scaleSkills[13] + scaleJM[13] + scaleEN[13] + scaleMA[13] + scaleGear[13] + scaleRune[13] + scaleTE[13] + scaleBond[13] + scaleEXP[13])/100)));
  cp += luk;
  var luk_map = addCardGS[13] + addGA[13] + addCA[13];
  luk_map = Math.trunc((luk_map) + Math.trunc((luk + luk_map + addCrystal[13]) * ((scaleBA[13])/100)));
  luk = luk + luk_map + addCrystal[13];

  healing = Math.trunc((healing) + Math.trunc((healing) * ((scaleSkills[9] + scaleJM[9] + scaleEN[9] + scaleMA[9] + scaleGear[9] + scaleRune[9] + scaleTE[9] + scaleBond[9] + scaleEXP[9])/100)));
  var healing_map = addCardGS[9] + addGA[9] + addCA[9];
  healing_map = Math.trunc((healing_map) + Math.trunc((healing + healing_map + addCrystal[9]) * ((scaleBA[9])/100)));
  healing = healing + healing_map + addCrystal[9];

  document.getElementById("cp").innerHTML = cp;

  if(hp_map != 0) {
    var spanEl = document.createElement("span");
    hp_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (hp_map <= 0 ? "" : "+") + hp_map + ")";
    var statEl = document.getElementById("hp");
    statEl.innerHTML = "";
    statEl.appendChild(spanEl);
    statEl.appendChild(document.createTextNode(hp));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("hp").innerHTML = hp;
  }
  if(mp_map != 0) {
    var spanEl = document.createElement("span");
    mp_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (mp_map <= 0 ? "" : "+") + mp_map + ")";
    var statEl = document.getElementById("mp");
    statEl.innerHTML = "";
    statEl.appendChild(spanEl);
    statEl.appendChild(document.createTextNode(mp));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("mp").innerHTML = mp;
  }
  if(atk_map != 0) {
    var spanEl = document.createElement("span");
    atk_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (atk_map <= 0 ? "" : "+") + atk_map + ")";
    var statEl = document.getElementById("atk");
    statEl.innerHTML = "";
    statEl.appendChild(spanEl);
    statEl.appendChild(document.createTextNode(atk));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("atk").innerHTML = atk;
  }
  if(def_map != 0) {
    var spanEl = document.createElement("span");
    def_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (def_map <= 0 ? "" : "+") + def_map + ")";
    var statEl = document.getElementById("def");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(def));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("def").innerHTML = def;
  }
  if(mag_map != 0) {
    var spanEl = document.createElement("span");
    mag_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (mag_map <= 0 ? "" : "+") + mag_map + ")";
    var statEl = document.getElementById("mag");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(mag));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("mag").innerHTML = mag;
  }
  if(mnd_map != 0) {
    var spanEl = document.createElement("span");
    mnd_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (mnd_map <= 0 ? "" : "+") + mnd_map + ")";
    var statEl = document.getElementById("mnd");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(mnd));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("mnd").innerHTML = mnd;
  }
  if(dex_map != 0) {
    var spanEl = document.createElement("span");
    dex_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (dex_map <= 0 ? "" : "+") + dex_map + ")";
    var statEl = document.getElementById("dex");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(dex));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("dex").innerHTML = dex;
  }
  if(spd_map != 0) {
    var spanEl = document.createElement("span");
    spd_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (spd_map <= 0 ? "" : "+") + spd_map + ")";
    var statEl = document.getElementById("spd");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(spd));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("spd").innerHTML = spd;
  }
  if(cri_map != 0) {
    var spanEl = document.createElement("span");
    cri_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (cri_map <= 0 ? "" : "+") + cri_map + ")";
    var statEl = document.getElementById("cri");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(cri));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("cri").innerHTML = cri;
  }
  if(luk_map != 0) {
    var spanEl = document.createElement("span");
    luk_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (luk_map <= 0 ? "" : "+") + luk_map + ")";
    var statEl = document.getElementById("luk");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(luk));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("luk").innerHTML = luk;
  }
  if(move_map != 0) {
    var spanEl = document.createElement("span");
    move_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (move_map <= 0 ? "" : "+") + move_map + ")";
    var statEl = document.getElementById("move");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(move));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("move").innerHTML = move;
  }
  if(jmp_map != 0) {
    var spanEl = document.createElement("span");
    jmp_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (jmp_map <= 0 ? "" : "+") + jmp_map + ")";
    var statEl = document.getElementById("jmp");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(jmp));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("jmp").innerHTML = jmp;
  }
  if(unitData.jobs_data[unitJob].inimp == 0) {
    document.getElementById("imp").innerHTML = stat_mp;
  }
  if(imp_map != 0) {
    var spanEl = document.createElement("span");
    imp_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (imp_map <= 0 ? "" : "+") + imp_map + ")";
    var statEl = document.getElementById("imp");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(Math.trunc(stat_mp * ((100 + unitData.jobs_data[unitJob].inimp) / 100) + imp)));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("imp").innerHTML = Math.trunc(stat_mp * ((100 + unitData.jobs_data[unitJob].inimp) / 100) + imp);
  }
  if(healing_map != 0) {
    var spanEl = document.createElement("span");
    healing_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
    spanEl.textContent = " (" + (healing_map <= 0 ? "" : "+") + healing_map + ")";
    var statEl = document.getElementById("healing");
    statEl.innerHTML = "";
    statEl.appendChild(document.createTextNode(healing));
    statEl.appendChild(spanEl);
  }
  else {
    document.getElementById("healing").innerHTML = healing;
  }

  var resistances = document.getElementById("resistances");
  resistances.innerHTML = "";

  var otherStats = document.getElementById("otherStats");
  otherStats.innerHTML = "";

  for(var a = 16; a < addStats.length; a++) {
    if(addStats[a] != 0 || addSkills[a] != 0 || addGear[a] != 0 || addMA[a] != 0 || addCard[a] != 0 || addEN[a] != 0 || addJM[a] != 0 || addCardGS[a] != 0 || addGA[a] != 0 || addCA[a] != 0 || subGear[a] != 0 || addRune[a] != 0 || addTE[a] != 0 || addBond[a] != 0 || addEXP[a] != 0 || addCrystal[a] != 0) {
      var trEl = document.createElement("tr");
      var thEl = document.createElement("th");
      thEl.appendChild(document.createTextNode(statTypes[a]));
      trEl.appendChild(thEl);

      var tdEl = document.createElement("td");
      tdEl.className = "text-nowrap";
      var other = addStats[a] + addSkills[a] + addGear[a] + addMA[a] + addCard[a] + addEN[a] + addJM[a] + subGear[a] + addRune[a] + addTE[a] + addBond[a] + addEXP[a] + addCrystal[a];
      var other_map = addCardGS[a] + addGA[a] + addCA[a];
      other = other + other_map;
      if(other_map != 0) {
        var spanEl = document.createElement("span");
        if([83, 94, 95, 99, 122, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175].includes(a)) {
          if(other_map < 0) {
            spanEl.className = "text-success";
          }
          else {
            spanEl.className = "text-danger";
          }
        }
        else {
          if (other_map < 0) {
            spanEl.className = "text-danger";
          }
          else {
            spanEl.className = "text-success";
          }
        }
        spanEl.textContent = " (" + (other_map <= 0 ? "" : "+") + other_map + ")";
        tdEl.appendChild(document.createTextNode(other));
        tdEl.appendChild(spanEl);
      }
      else {
        tdEl.innerHTML = other;
      }
      trEl.appendChild(tdEl);

      if((a >= 49 && a <= 67) || a == 71 || a == 73 || a == 75 || a == 76) {
        resistances.appendChild(trEl);
      }
      else {
        otherStats.appendChild(trEl);
      }
    }
  }

  for(var a = 0; a < addGearTK.length; a++) {
    if(addSkillsTK[a] != 0 || addGearTK[a] != 0 || addMATK[a] != 0 || addCardTK[a] != 0 || addENTK[a] != 0 || addJMTK[a] != 0 || addCardGSTK[a] != 0 || addGATK[a] != 0 || addCATK[a] != 0 || addTETK[a] != 0 || addBondTK[a] != 0 || addEXPTK[a] != 0 || addCrystalTK[a] != 0) {
      var trEl = document.createElement("tr");
      var thEl = document.createElement("th");
      thEl.appendChild(document.createTextNode("Strong vs " + tokkouTypes[a]));
      trEl.appendChild(thEl);

      var tdEl = document.createElement("td");
      tdEl.className = "text-nowrap";
      var tokkou = addSkillsTK[a] + addGearTK[a] + addMATK[a] + addCardTK[a] + addENTK[a] + addJMTK[a] + addTETK[a] + addBondTK[a] + addEXPTK[a] + addCrystalTK[a];
      var tokkou_map = addCardGSTK[a] + addGATK[a] + addCATK[a];
      tokkou = tokkou + tokkou_map;
      if(tokkou_map != 0) {
        var spanEl = document.createElement("span");
        tokkou_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
        spanEl.textContent = " (" + (tokkou_map <= 0 ? "" : "+") + tokkou_map + ")";
        tdEl.appendChild(document.createTextNode(tokkou));
        tdEl.appendChild(spanEl);
      }
      else {
        tdEl.innerHTML = tokkou;
      }
      trEl.appendChild(tdEl);

      otherStats.appendChild(trEl);
    }
  }
  for(var a = 0; a < addGearTK2.length; a++) {
    if(addSkillsTK2[a] != 0 || addGearTK2[a] != 0 || addMATK2[a] != 0 || addCardTK2[a] != 0 || addENTK2[a] != 0 || addJMTK2[a] != 0 || addCardGSTK2[a] != 0 || addGATK2[a] != 0 || addCATK2[a] != 0 || addTETK2[a] != 0 || addBondTK2[a] != 0 || addEXPTK2[a] != 0 || addCrystalTK2[a] != 0) {
      var trEl = document.createElement("tr");
      var thEl = document.createElement("th");
      thEl.appendChild(document.createTextNode("DEF vs " + tokkouTypes[a]));
      trEl.appendChild(thEl);

      var tdEl = document.createElement("td");
      tdEl.className = "text-nowrap";
      var tokkou = addSkillsTK2[a] + addGearTK2[a] + addMATK2[a] + addCardTK2[a] + addENTK2[a] + addJMTK2[a] + addTETK2[a] + addBondTK2[a] + addEXPTK2[a] + addCrystalTK2[a];
      var tokkou_map = addCardGSTK2[a] + addGATK2[a] + addCATK2[a];
      tokkou = tokkou + tokkou_map;
      if(tokkou_map != 0) {
        var spanEl = document.createElement("span");
        tokkou_map < 0 ? spanEl.className = "text-danger" : spanEl.className = "text-success";
        spanEl.textContent = " (" + (tokkou_map <= 0 ? "" : "+") + tokkou_map + ")";
        tdEl.appendChild(document.createTextNode(tokkou));
        tdEl.appendChild(spanEl);
      }
      else {
        tdEl.innerHTML = tokkou;
      }
      trEl.appendChild(tdEl);

      otherStats.appendChild(trEl);
    }
  }
}

function setGearList() {
  var activeSlot = document.getElementById("gear").querySelector(".gear-icon.active");
  var gearContainer = document.getElementById("gearsList");
  var gearSlots = document.getElementById("gear").querySelectorAll(".gear-icon");
  gearContainer.innerHTML = "";
  var gearDiv = document.createElement("div");
  gearDiv.className = "gear-icons";
  var relatedGearDiv = document.createElement("div");
  relatedGearDiv.className = "gear-icons related-gear";

  for(var i = 0; i < gearList.length; i++) {
    if(gearSlots[0].hasAttribute("data-gear-id") || gearSlots[1].hasAttribute("data-gear-id") || gearSlots[2].hasAttribute("data-gear-id")) {
      var gear1 = gearSlots[0].getAttribute("data-gear-id");
      var gear2 = gearSlots[1].getAttribute("data-gear-id");
      var gear3 = gearSlots[2].getAttribute("data-gear-id");
      var gear1Type = gearSlots[0].getAttribute("data-type-id");
      var gear2Type = gearSlots[1].getAttribute("data-type-id");
      var gear3Type = gearSlots[2].getAttribute("data-type-id");
      var activeGear = document.querySelector("#gear .gear-icon.active").getAttribute("data-gear-id");
      if(gear1 == i || gear2 == i || gear3 == i) { continue; }
      else if(gearList[i].data.type == gear1Type && gear1 != activeGear && gearList[i].data.type != 3) { continue; }
      else if(gearList[i].data.type == gear2Type && gear2 != activeGear && gearList[i].data.type != 3) { continue; }
      else if(gearList[i].data.type == gear3Type && gear3 != activeGear && gearList[i].data.type != 3) { continue; }
    }

    var cnd_flag = true;
    var unit_flag = false;
    var sm_flag = false;
    var cnd_count = 0;

    if(gearList[i].data.hasOwnProperty("cond_sm_data")) {
      var conds = gearList[i].data.cond_sm_data.datas;
      cnd_flag = false;
      sm_flag = true;
      for(var a = 0; a < conds.length; a++) {
        if(conds[a].hasOwnProperty("unit_ids")) {
          cnd_flag = false;
          for(var b = 0; b < conds[a].unit_ids.length; b++) {
            if(unitData.iname == conds[a].unit_ids[b]) {
              cnd_flag = true;
              unit_flag = true;
              break;
            }
          }
        }
        if(conds[a].hasOwnProperty("job_ids")) {
          cnd_flag = false;
          for(var b = 0; b < conds[a].job_ids.length; b++) {
            if(unitData.jobsets_data[unitJob].iname == conds[a].job_ids[b]) {
              cnd_flag = true;
              break;
            }
          }
        }
        if(cnd_flag) {
          break;
        }
      }
    }

    if(!sm_flag || (sm_flag && !cnd_flag)) {
      cnd_flag = true;
      if(gearList[i].data.hasOwnProperty("units")) {
        cnd_flag = false;
        cnd_count += 1;
        for(var a = 0; a < gearList[i].data.units.length; a++) {
          if(unitData.iname == gearList[i].data.units[a]) {
            cnd_flag = true;
            unit_flag = true;
            break;
          }
        }
        if(!cnd_flag) {
          continue;
        }
      }
      else if(gearList[i].data.hasOwnProperty("recommended_units")) {
        for(var a = 0; a < gearList[i].data.recommended_units.length; a++) {
          if(unitData.iname == gearList[i].data.recommended_units[a]) {
            unit_flag = true;
            break;
          }
        }
      }
      if(gearList[i].data.hasOwnProperty("jobs")) {
        cnd_flag = false;
        cnd_count += 1;
        for(var a = 0; a < gearList[i].data.jobs.length; a++) {
          if(unitData.jobs_data[unitJob].iname == gearList[i].data.jobs[a] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == gearList[i].data.jobs[a])) {
            cnd_flag = true;
            break;
          }
        }
        if(!cnd_flag) {
          continue;
        }
      }
      if(gearList[i].data.hasOwnProperty("birth")) {
        cnd_count += 1;
        if(gearList[i].data.birth != unitData.birth) {
          cnd_flag = false;
          continue;
        }
      }
      if(gearList[i].data.hasOwnProperty("sex")) {
        cnd_count += 1;
        if(gearList[i].data.sex != unitData.sex) {
          cnd_flag = false;
          continue;
        }
      }
      if(gearList[i].data.hasOwnProperty("elem")) {
        cnd_count += 1;
        if(gearList[i].data.elem != unitData.elem) {
          cnd_flag = false;
          continue;
        }
      }
      if(gearList[i].data.type == 1) {
        if(unitData.jobs_data[unitJob].hasOwnProperty("artifact_data") && unitData.jobs_data[unitJob].artifact_data.hasOwnProperty("tag")) {
          if(unitData.jobs_data[unitJob].artifact_data.tag != gearList[i].data.tag) {
            cnd_flag = false;
            continue;
          }
        }
        else {
          cnd_flag = false;
          continue;
        }
      }
    }

    if(cnd_flag) {
      var gearEl = document.createElement("div");
      gearEl.className = "gear-icon";
      gearEl.setAttribute("data-gear-id", i);
      gearEl.setAttribute("data-type-id", gearList[i].data.type);
      gearEl.setAttribute("data-min-id", gearList[i].data.rini+1);
      gearEl.title = gearList[i].data.name;
      var gearIcon = document.createElement("div");
      gearIcon.className = "icon tiny-icon icon-" + (gearList[i].data.rini+1);
      var gearImg = document.createElement("img");
      gearImg.src = imgPath + "/images/ArtiIcon/" + gearList[i].data.icon + ".png";
      var gearType = document.createElement("div");
      gearType.className = "type type-" + gearList[i].data.type;
      var gearStar = document.createElement("div");
      gearStar.className = "star-icon star-" + (gearList[i].data.rini+1);

      gearType.appendChild(gearStar);
      gearIcon.appendChild(gearImg);
      gearIcon.appendChild(gearType);
      gearEl.appendChild(gearIcon);
      gearEl.addEventListener("click", function(e) {
        activeSlot.setAttribute("data-gear-id", this.getAttribute("data-gear-id"));
        activeSlot.setAttribute("data-type-id", this.getAttribute("data-type-id"));
        activeSlot.setAttribute("data-min-id", this.getAttribute("data-min-id"));
        activeSlot.setAttribute("data-rank-id", 5);
        var myModal = Modal.getInstance(document.getElementById("gearModal"));
        myModal.hide();
        updateUnit(3);
      });

      var abil_cnd_flag = true;
      var abil_unit_flag = false;
      var abil_cnd_count = 0;

      if(gearList[i].data.hasOwnProperty("abils_data")) {
        var abilityCount = gearList[i].data.abils_data.length;
        for(var s = 0; s < abilityCount; s++) {
          abil_cnd_flag = true;
          abil_unit_flag = false;
          abil_cnd_count = 0;
          if(gearList[i].data.abils_data[s].hasOwnProperty("units")) {
            var arrayLength = gearList[i].data.abils_data[s].units.length;
            abil_cnd_flag = false;
            abil_cnd_count += 1;
            for(var u = 0; u < arrayLength; u++) {
              if(unitData.iname == gearList[i].data.abils_data[s].units[u]) {
                abil_cnd_flag = true;
                abil_unit_flag = true;
                break;
              }
            }
          }
          if(gearList[i].data.abils_data[s].hasOwnProperty("jobs")) {
            var arrayLength = gearList[i].data.abils_data[s].jobs.length;
            abil_cnd_flag = false;
            abil_cnd_count += 1;
            for(var u = 0; u < arrayLength; u++) {
              if(unitData.jobs_data[unitJob].iname == gearList[i].data.abils_data[s].jobs[u] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == gearList[i].data.abils_data[s].jobs[u])) {
                cnd_flag = true;
                break;
              }
            }
          }
          if(gearList[i].data.abils_data[s].hasOwnProperty("elem")) {
            abil_cnd_count += 1;
            if(gearList[i].data.abils_data[s].elem != unitData.elem) {
              abil_cnd_flag = false;
            }
          }
          if(gearList[i].data.abils_data[s].hasOwnProperty("sex")) {
            abil_cnd_count += 1;
            if(gearList[i].data.abils_data[s].sex != unitData.sex) {
              abil_cnd_flag = false;
            }
          }
          if(abil_cnd_flag) {
            if(abil_unit_flag || (cnd_count != 0 && abil_cnd_count != 0) || abil_cnd_count > 1) {
              break;
            }
          }
        }
      }
      if((unit_flag || abil_unit_flag) || (cnd_count != 0 && (abil_cnd_flag && abil_cnd_count != 0)) || (cnd_count > 1 || (abil_cnd_flag && abil_cnd_count > 1))) {
        relatedGearDiv.appendChild(gearEl);
      }
      else {
        gearDiv.appendChild(gearEl);
      }
    }
  }
  if(relatedGearDiv.children.length != 0) {
    var relatedGearHeading = document.createElement("h6");
    relatedGearHeading.append(document.createTextNode("Related Gear"));
    gearContainer.appendChild(relatedGearHeading);
    gearContainer.appendChild(relatedGearDiv);
  }
  var otherGearHeading = document.createElement("h6");
  if(relatedGearDiv.children.length != 0) {
    otherGearHeading.className = "mt-3";
  }
  otherGearHeading.append(document.createTextNode("Other Gear"));
  gearContainer.appendChild(otherGearHeading);
  gearContainer.appendChild(gearDiv);
}

function setCardList() {
  var activeSlot = document.getElementById("cardEquipment").querySelector(".card-icon.active");
  var cardContainer = document.getElementById("cardsList");
  var cardSlots = document.getElementById("cardEquipment").querySelectorAll(".card-icon");
  cardContainer.innerHTML = "";
  var cardDiv = document.createElement("div");
  cardDiv.className = 'item';
  var primaryCardDiv = document.createElement("div");
  primaryCardDiv.className = 'item related-cards';
  var relatedCardDiv = document.createElement("div");
  relatedCardDiv.className = 'item related-cards';
  for(var i = 0; i < cardList.length; i++) {
    if(cardSlots[0].hasAttribute("data-card-id") || cardSlots[1].hasAttribute("data-card-id")) {
      var card1 = cardSlots[0].getAttribute("data-card-id");
      var card2 = cardSlots[1].getAttribute("data-card-id");
      if(card1 == i || card2 == i) { continue; }
    }
    var cardEl = document.createElement("div");
    cardEl.className = "card-icon";
    cardEl.setAttribute("data-card-id", i);
    cardEl.setAttribute("data-limit-break", 5);
    cardEl.title = cardList[i].data.name;
    var cardIcon = document.createElement("div");
    cardIcon.className = "icon tiny-icon icon-" + (cardList[i].data.rare+1);
    var cardImg = document.createElement("img");
    cardImg.src = imgPath + "/images/ConceptCardIcon/" + cardList[i].data.icon + ".png";
    var cardStar = document.createElement("div");
    cardStar.className = "star-icon star-" + (cardList[i].data.rare+1);

    cardIcon.appendChild(cardImg);
    cardIcon.appendChild(cardStar);
    cardEl.appendChild(cardIcon);
    cardEl.addEventListener("click", function(e) {
      activeSlot.setAttribute("data-card-id", this.getAttribute("data-card-id"));
      activeSlot.setAttribute("data-limit-break", this.getAttribute("data-limit-break"));
      var myModal = Modal.getInstance(document.getElementById("cardModal"));
      myModal.hide();
      updateUnit(5);
    });

    var related_check = false;
    var primary_check = false;

    if(cardList[i].data.hasOwnProperty("card_skills")) {
      var skillCount = cardList[i].data.card_skills.length;
      var skill_array = [];
      var primary_skill_array = [];
      var related_skill_array = [];

      for(var a = 0; a < skillCount; a++) {
        var cnd_flag = true;
        var cnd_count = 0;
        var duplicate_flag = false;
        var card_skill = cardList[i].data.card_skills[a].card_skill_data;
        for(var c = 0; c < skill_array.length; c++) {
          if(skill_array[c] == card_skill.iname) {
            duplicate_flag = true;
            break;
          }
        }
        if(!duplicate_flag) {
          skill_array.push(card_skill.iname);
        }
        if(cardList[i].data.card_skills[a].hasOwnProperty("cnds_data")) {
          var skill = cardList[i].data.card_skills[a].cnds_data;
          if(skill.hasOwnProperty("unit_group_data")) {
            var arrayLength = skill.unit_group_data.units.length;
            cnd_flag = false;
            cnd_count += 1;
            for(var c = 0; c < arrayLength; c++) {
              if(skill.unit_group_data.units[c] == unitData.iname) {
                cnd_flag = true;
                break;
              }
            }
          }
          if(skill.hasOwnProperty("job_group_data")) {
            var arrayLength = skill.job_group_data.jobs.length;
            cnd_flag = false;
            cnd_count += 1;
            for(var c = 0; c < arrayLength; c++) {
              if(unitData.jobs_data[unitJob].iname == skill.job_group_data.jobs[c] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == skill.job_group_data.jobs[c])) {
                cnd_flag = true;
                break;
              }
            }
          }
          if(skill.hasOwnProperty("birth_id")) {
            var arrayLength = skill.birth_id.length;
            cnd_flag = false;
            cnd_count += 1;
            for(var c = 0; c < arrayLength; c++) {
              if(unitData.hasOwnProperty("birth_id") && skill.birth_id[c] == unitData.birth_id) {
                cnd_flag = true;
                break;
              }
            }
          }
          if(skill.hasOwnProperty("el_fire") || skill.hasOwnProperty("el_watr") || skill.hasOwnProperty("el_wind") || skill.hasOwnProperty("el_thdr") || skill.hasOwnProperty("el_lit") || skill.hasOwnProperty("el_drk")) {
            cnd_count += 1;
            if(skill.hasOwnProperty("el_fire")) {
              if(unitData.elem != 1) {
                cnd_flag = false;
              }
            }
            if(skill.hasOwnProperty("el_watr")) {
              if(unitData.elem != 2) {
                cnd_flag = false;
              }
            }
            if(skill.hasOwnProperty("el_wind")) {
              if(unitData.elem != 3) {
                cnd_flag = false;
              }
            }
            if(skill.hasOwnProperty("el_thdr")) {
              if(unitData.elem != 4) {
                cnd_flag = false;
              }
            }
            if(skill.hasOwnProperty("el_lit")) {
              if(unitData.elem != 5) {
                cnd_flag = false;
              }
            }
            if(skill.hasOwnProperty("el_drk")) {
              if(unitData.elem != 6) {
                cnd_flag = false;
              }
            }
          }
          if(skill.hasOwnProperty("sex")) {
            cnd_count += 1;
            if(skill.sex != unitData.sex) {
              cnd_flag = false;
            }
          }
        }

        var buff = cardList[i].data.card_skills[a].card_skill_data.t_buff_data;
        var buff_cnd_flag = true;
        var buff_cnd_count = 0;
        var custom_target_flag = true;
        var custom_target_count = 0;

        if(buff.hasOwnProperty("unit_group_data")) {
          var arrayLength = buff.unit_group_data.units.length;
          buff_cnd_flag = false;
          buff_cnd_count += 1;
          for(var c = 0; c < arrayLength; c++) {
            if(buff.unit_group_data.units[c] == unitData.iname) {
              buff_cnd_flag = true;
              break;
            }
          }
        }
        if(buff.hasOwnProperty("birth")) {
          buff_cnd_count += 1;
          if(buff.birth != unitData.birth) {
            buff_cnd_flag = false;
          }
        }
        if(buff.hasOwnProperty("sex")) {
          if(buff.sex != unitData.sex) {
            buff_cnd_flag = false;
          }
        }
        if(buff.hasOwnProperty("elem")) {
          if(buff.elem == 1 && unitData.elem != 1) {
            buff_cnd_flag = false;
          }
          else if(buff.elem == 10 && unitData.elem != 2) {
            buff_cnd_flag = false;
          }
          else if(buff.elem == 100 && unitData.elem != 3) {
            buff_cnd_flag = false;
          }
          else if(buff.elem == 1000 && unitData.elem != 4) {
            buff_cnd_flag = false;
          }
          else if(buff.elem == 10000 && unitData.elem != 5) {
            buff_cnd_flag = false;
          }
          else if(buff.elem == 100000 && unitData.elem != 6) {
            buff_cnd_flag = false;
          }
        }

        if(buff.hasOwnProperty("custom_targets_data")) {
          var arrayLength = buff.custom_targets_data.length;
          for(var c = 0; c < arrayLength; c++) {
            custom_target_flag = true;
            if(buff.custom_targets_data[c].hasOwnProperty("units")) {
              var subArrayLength = buff.custom_targets_data[c].units.length;
              custom_target_flag = false;
              custom_target_count += 1;
              for(var s = 0; s < subArrayLength; s++) {
                if(buff.custom_targets_data[c].units[s] == unitData.iname) {
                  custom_target_flag = true;
                  break;
                }
              }
            }
            if(buff.custom_targets_data[c].hasOwnProperty("unit_groups_data")) {
              var subArrayLength = buff.custom_targets_data[c].unit_groups_data.length;
              custom_target_flag = false;
              custom_target_count += 1;
              for(var s = 0; s < subArrayLength; s++) {
                var subGroupLength = buff.custom_targets_data[c].unit_groups_data[s].units.length;
                for(var t = 0; t < subGroupLength; t++) {
                  if(buff.custom_targets_data[c].unit_groups_data[s].units[t] == unitData.iname) {
                    custom_target_flag = true;
                    break;
                  }
                }
              }
            }
            if(buff.custom_targets_data[c].hasOwnProperty("job_groups_data")) {
              var subArrayLength = buff.custom_targets_data[c].job_groups_data.length;
              custom_target_flag = false;
              custom_target_count += 1;
              for(var s = 0; s < subArrayLength; s++) {
                var subGroupLength = buff.custom_targets_data[c].job_groups_data[s].jobs.length;
                for(var t = 0; t < subGroupLength; t++) {
                  if(unitData.jobs_data[unitJob].iname == buff.custom_targets_data[c].job_groups_data[s].jobs[t] || (unitData.jobs_data[unitJob].hasOwnProperty("origin") && unitData.jobs_data[unitJob].origin == buff.custom_targets_data[c].job_groups_data[s].jobs[t])) {
                    custom_target_flag = true;
                    break;
                  }
                }
              }
            }
            if(buff.custom_targets_data[c].hasOwnProperty("birth_id")) {
              custom_target_count += 1;
              if(unitData.hasOwnProperty("birth_id") && buff.custom_targets_data[c].birth_id != unitData.birth_id) {
                custom_target_flag = false;
              }
            }
            if(buff.custom_targets_data[c].hasOwnProperty("fire") && unitData.elem != 1) {
              custom_target_flag = false;
            }
            else if(buff.custom_targets_data[c].hasOwnProperty("water") && unitData.elem != 2) {
              custom_target_flag = false;
            }
            else if(buff.custom_targets_data[c].hasOwnProperty("wind") && unitData.elem != 3) {
              custom_target_flag = false;
            }
            else if(buff.custom_targets_data[c].hasOwnProperty("thunder") && unitData.elem != 4) {
              custom_target_flag = false;
            }
            else if(buff.custom_targets_data[c].hasOwnProperty("shine") && unitData.elem != 5) {
              custom_target_flag = false;
            }
            else if(buff.custom_targets_data[c].hasOwnProperty("dark") && unitData.elem != 6) {
              custom_target_flag = false;
            }
            if(buff.custom_targets_data[c].hasOwnProperty("sex") && buff.custom_targets_data[c].sex != unitData.sex) {
              custom_target_flag = false;
            }
            if(custom_target_flag) {
              break;
            }
          }
        }
        if(cnd_count != 0 || buff_cnd_count != 0 || custom_target_count != 0) {
          var duplicate_flag = false;
          if(cnd_flag && buff_cnd_flag && custom_target_flag && (buff_cnd_count != 0 || custom_target_count != 0)) {
            for(var c = 0; c < primary_skill_array.length; c++) {
              if(primary_skill_array[c] == card_skill.iname) {
                duplicate_flag = true;
                break;
              }
            }
            if(!duplicate_flag) {
              primary_skill_array.push(card_skill.iname);
            }
          }
          else if((cnd_flag && cnd_count != 0) || (buff_cnd_flag && custom_target_flag && (buff_cnd_count != 0 || custom_target_count != 0))) {
            for(var c = 0; c < related_skill_array.length; c++) {
              if(related_skill_array[c] == card_skill.iname) {
                duplicate_flag = true;
                break;
              }
            }
            if(!duplicate_flag) {
              related_skill_array.push(card_skill.iname);
            }
          }
        }
      }
    }

    if((primary_skill_array.length == skill_array.length && skill_array.length >= 2) || (primary_skill_array.length/skill_array.length >= 0.5 && skill_array.length >= 3)) {
      primary_check = true;
    }
    else if(primary_skill_array.length != 0 || related_skill_array.length != 0) {
      related_check = true;
    }

    if(primary_check) {
      primaryCardDiv.appendChild(cardEl);
    }
    else if(related_check) {
      relatedCardDiv.appendChild(cardEl);
    }
    else {
      cardDiv.appendChild(cardEl);
    }
  }
  if(primaryCardDiv.children.length != 0) {
    var primaryCardHeading = document.createElement("h6");
    primaryCardHeading.append(document.createTextNode("Primary Mementos"));
    cardContainer.appendChild(primaryCardHeading);
    cardContainer.appendChild(primaryCardDiv);
  }
  if(relatedCardDiv.children.length != 0) {
    var relatedCardHeading = document.createElement("h6");
    if(primaryCardDiv.children.length != 0) {
      relatedCardHeading.className = "mt-3";
    }
    relatedCardHeading.append(document.createTextNode("Related Mementos"));
    cardContainer.appendChild(relatedCardHeading);
    cardContainer.appendChild(relatedCardDiv);
  }
  var otherCardHeading = document.createElement("h6");
  if(primaryCardDiv.children.length != 0 || relatedCardDiv.children.length != 0) {
    otherCardHeading.className = "mt-3";
  }
  otherCardHeading.append(document.createTextNode("Other Mementos"));
  cardContainer.appendChild(otherCardHeading);
  cardContainer.appendChild(cardDiv);
}

function setRuneList() {
  var activeSlot = document.getElementById("runes").querySelector(".rune-icon.active");
  var activeRuneSlot = document.getElementById("runes").querySelector(".rune-icon.active").getAttribute("data-slot");
  var activeRune = document.getElementById("runes").querySelector(".rune-icon.active").getAttribute("data-rune-id");
  var runeContainer = document.getElementById("runesList");
  runeContainer.innerHTML = "";
  var runeDiv = document.createElement("div");
  runeDiv.className = "rune-icons";
  for(var i = 0; i < runeList.length; i++) {
    if(activeRune == i || activeRuneSlot != runeList[i].data.slot) { continue; }
    var runeEl = document.createElement("div");
    runeEl.className = "rune-icon";
    runeEl.setAttribute("data-rune-id", i);
    runeEl.setAttribute("data-set", runeList[i].data.seteff_type);
    runeEl.setAttribute("data-enhancement", 12);
    runeEl.title = runeList[i].data.name;
    var runeIcon = document.createElement("div");
    runeIcon.className = "icon tiny-icon icon-" + (runeList[i].data.rarity+1);
    var runeImg = document.createElement("img");
    runeImg.src = imgPath + "/images/ItemIcon/" + runeList[i].data.icon + ".png";
    var runeSet = document.createElement("div");
    runeSet.className = "set set-" + runeList[i].data.seteff_type;

    runeIcon.appendChild(runeImg);
    runeIcon.appendChild(runeSet);
    runeEl.appendChild(runeIcon);
    runeEl.addEventListener("click", function(e) {
      activeSlot.setAttribute("data-rune-id", this.getAttribute("data-rune-id"));
      activeSlot.setAttribute("data-set", this.getAttribute("data-set"));
      activeSlot.setAttribute("data-enhancement", this.getAttribute("data-enhancement"));
      var myModal = Modal.getInstance(document.getElementById("runeModal"));
      myModal.hide();
      setRuneStats(this);
      myModal = Modal.getOrCreateInstance(document.getElementById("runeStatsModal"));
      myModal.show();
    });

    runeDiv.appendChild(runeEl);

  }
  runeContainer.appendChild(runeDiv);
}

function setRuneStats(runeData) {
  var baseStats = []
  var evoStats = []
  var rune = runeData.getAttribute("data-rune-id");
  var enhancement = parseInt(runeData.getAttribute("data-enhancement"));
  var runeContainer = document.getElementById("runeStats");
  runeContainer.innerHTML = "";
  if(runeList[rune] != null) {
    var baseState = runeList[rune].data.base_state_data.lottery_state_data;
    var baseStateLength = baseState.length;
    var baseStat = "";
    var minVal = 0;
    var maxVal = 0;
    var val = 0;
    if (runeData.hasAttribute("data-base-stat")) {
      baseStat = runeData.getAttribute("data-base-stat").split(",");
    }
    for(var i = 0; i < baseStateLength; i++) {
      var statArray = []
      statArray.push(baseState[i].base_state_data.type);
      var lotteryLength = baseState[i].base_state_data.lottery.length;
      for(var x = 0; x < lotteryLength; x++) {
        if(x == 0) {
          statArray.push(baseState[i].base_state_data.lottery[x].min);
        }
        if(x == lotteryLength - 1) {
          statArray.push(baseState[i].base_state_data.lottery[x].max);
        }
      }
      baseStats.push(statArray);
    }
    var formRow = document.createElement("div");
    formRow.className = "row m-0";

    var formDiv = document.createElement("div");
    formDiv.className = "form-group col-md-4";
    var formLabel = document.createElement("label");
    formLabel.setAttribute("for","baseSelect");
    formLabel.className = "form-label";
    formLabel.innerHTML = "Basic Stat";
    formDiv.appendChild(formLabel);
    var baseSelect = document.createElement("select");
    baseSelect.id = "baseSelect";
    baseSelect.className = "form-select index-control form-select-sm";
    var option = document.createElement("option");
    option.value = 0;
    baseSelect.appendChild(option);
    for (var i = 0; i < baseStats.length; i++) {
      var option = document.createElement("option");
      option.value = baseStats[i][0];
      option.text = statTypes[baseStats[i][0]];
      option.setAttribute("data-min-val", baseStats[i][1]);
      option.setAttribute("data-max-val", baseStats[i][2]);
      if(baseStat != "") {
        if(baseStats[i][0] == baseStat[0]) {
          minVal = baseStats[i][1];
          maxVal = baseStats[i][2];
          val = baseStat[1];
          option.selected = true;
        }
      }
      baseSelect.appendChild(option);
    }
    baseSelect.addEventListener("change", function(e) {
      var select = this;
      var val = 0;
      var min = 0;
      var max = 0;
      if(select.value != 0) {
        val = select.value;
        min = select.options[select.selectedIndex].getAttribute("data-min-val");
        max = select.options[select.selectedIndex].getAttribute("data-max-val");
      }
      var range = select.parentElement.nextSibling;
      range.getElementsByClassName("form-range")[0].min = min;
      range.getElementsByClassName("form-range")[0].max = max;
      range.getElementsByClassName("form-range")[0].value = max;
      range.getElementsByClassName("custom-value")[0].innerHTML = max;
    });
    formDiv.appendChild(baseSelect);
    formRow.appendChild(formDiv);

    var formDiv = document.createElement("div");
    formDiv.className = "form-group col-md-8";
    var formLabel = document.createElement("label");
    formLabel.setAttribute("for","baseRange");
    formLabel.className = "form-label";
    formLabel.innerHTML = "Stat Range";
    formDiv.appendChild(formLabel);
    var rangeDiv = document.createElement("div");
    rangeDiv.className = "d-flex";
    var baseRange = document.createElement("input");
    baseRange.type = "range";
    baseRange.id = "baseRange";
    baseRange.className = "form-range";
    baseRange.min = 0;
    baseRange.max = 0;
    baseRange.value = 0;
    if(baseStat != "") {
      baseRange.min = minVal;
      baseRange.max = maxVal;
      baseRange.value = val;
    }
    var rangeSpan = document.createElement("span");
    rangeSpan.className = "custom-value ms-2";
    rangeSpan.appendChild(document.createTextNode(val));
    baseRange.addEventListener("change", function(e) {
      e.target.nextSibling.innerHTML = e.target.value;
    });
    rangeDiv.appendChild(baseRange);
    rangeDiv.appendChild(rangeSpan);

    formDiv.appendChild(rangeDiv);
    formRow.appendChild(formDiv);

    runeContainer.appendChild(formRow);

    var evoState = runeList[rune].data.evo_state_data.lottery_state_data;
    var evoStateLength = evoState.length;
    var evoStat = "";
    for(var i = 0; i < evoStateLength; i++) {
      var statArray = []
      statArray.push(evoState[i].base_state_data.type);
      lotteryLength = evoState[i].base_state_data.lottery.length;
      for(var x = 0; x < lotteryLength; x++) {
        if(x == 0) {
          statArray.push(evoState[i].base_state_data.lottery[x].min);
        }
        if(x == lotteryLength - 1) {
          statArray.push(evoState[i].base_state_data.lottery[x].max);
        }
      }
      evoStats.push(statArray);
    }
    if (runeData.hasAttribute("data-evo-stat")) {
      evoStat = runeData.getAttribute("data-evo-stat").split(",");
    }

    for(var i = 1; i < 4; i++) {
      var minVal = 0;
      var maxVal = 0;
      var val = 0;
      
      var formRow = document.createElement("div");
      formRow.className = "row m-0";

      var formDiv = document.createElement("div");
      formDiv.className = "form-group col-md-4";
      var formLabel = document.createElement("label");
      formLabel.setAttribute("for","evoSelect" + i);
      formLabel.innerHTML = "Awakened Stat " + i;
      formDiv.appendChild(formLabel);
      var evoSelect = document.createElement("select");
      evoSelect.id = "evoSelect" + i;
      evoSelect.className = "form-select index-control form-select-sm";
      if(i == 1 && enhancement < 4) {
        evoSelect.disabled = true;
      }
      if(i == 2 && enhancement < 7) {
        evoSelect.disabled = true;
      }
      if(i == 3 && enhancement < 10) {
        evoSelect.disabled = true;
      }
      var option = document.createElement("option");
      option.value = 0;
      evoSelect.appendChild(option);
      for (var x = 0; x < evoStats.length; x++) {
        var option = document.createElement("option");
        option.value = evoStats[x][0];
        option.text = statTypes[evoStats[x][0]];
        option.setAttribute("data-min-val", evoStats[x][1]);
        option.setAttribute("data-max-val", evoStats[x][2]);
        if(evoStat != "") {
          if(i == 1 && evoStats[x][0] == evoStat[0]) {
            minVal = evoStats[x][1];
            maxVal = evoStats[x][2];
            val = evoStat[1];
            option.selected = true;
          }
          else if(i == 2 && evoStats[x][0] == evoStat[2]) {
            minVal = evoStats[x][1];
            maxVal = evoStats[x][2];
            val = evoStat[3];
            option.selected = true;
          }
          else if(i == 3 && evoStats[x][0] == evoStat[4]) {
            minVal = evoStats[x][1];
            maxVal = evoStats[x][2];
            val = evoStat[5];
            option.selected = true;
          }
        }
        evoSelect.appendChild(option);
      }
      evoSelect.addEventListener("change", function(e) {
        var select = this;
        var val = 0;
        var min = 0;
        var max = 0;
        if(select.value != 0) {
          val = select.value;
          min = select.options[select.selectedIndex].getAttribute("data-min-val");
          max = select.options[select.selectedIndex].getAttribute("data-max-val");
        }
        var range = select.parentElement.nextSibling;
        range.getElementsByClassName("form-range")[0].min = min;
        range.getElementsByClassName("form-range")[0].max = max;
        range.getElementsByClassName("form-range")[0].value = max;
        range.getElementsByClassName("custom-value")[0].innerHTML = max;
      });
      formDiv.appendChild(evoSelect);
      formRow.appendChild(formDiv);

      var formDiv = document.createElement("div");
      formDiv.className = "form-group col-md-8";
      var formLabel = document.createElement("label");
      formLabel.setAttribute("for","evoRange" + i);
      formLabel.innerHTML = "Stat Range";
      formDiv.appendChild(formLabel);
      var rangeDiv = document.createElement("div");
      rangeDiv.className = "d-flex";
      var evoRange = document.createElement("input");
      evoRange.type = "range";
      evoRange.id = "evoRange" + i;
      evoRange.className = "form-range";
      evoRange.min = 0;
      evoRange.max = 0;
      evoRange.value = 0;
      if(evoStat != "") {
        evoRange.min = minVal;
        evoRange.max = maxVal;
        evoRange.value = val;
      }
      var rangeSpan = document.createElement("span");
      rangeSpan.className = "custom-value ms-2";
      rangeSpan.appendChild(document.createTextNode(val));
      evoRange.addEventListener("change", function(e) {
        e.target.nextSibling.innerHTML = e.target.value;
      });
      rangeDiv.appendChild(evoRange);
      rangeDiv.appendChild(rangeSpan);

      formDiv.appendChild(rangeDiv);
      formRow.appendChild(formDiv);

      runeContainer.appendChild(formRow);
    }
  }
}

function updateRuneStats() {
  var activeSlot = document.getElementById("runes").querySelector(".rune-icon.active");
  var baseSelect = document.getElementById("baseSelect");
  var baseRange = document.getElementById("baseRange");
  var baseStatType = baseSelect.options[baseSelect.selectedIndex].value;
  var baseStatVal = baseRange.value;

  var evoStats = "";
  for(var i = 1; i < 4; i++) {
    var evoSelect = document.getElementById("evoSelect" + i);
    var evoRange = document.getElementById("evoRange" + i);
    var evoStatType = evoSelect.options[evoSelect.selectedIndex].value;
    var evoStatVal = evoRange.value;
    evoStats += evoStatType + "," + evoStatVal;
    if(i != 3) {
      evoStats += ",";
    }
  }

  activeSlot.setAttribute("data-base-stat", [baseStatType, baseStatVal]);
  activeSlot.setAttribute("data-evo-stat", evoStats);

  updateUnit(11);
}

function setCrystalList() {
  var activeSlot = document.getElementById("crystals").querySelector(".crystal-icon.active");
  var crystalContainer = document.getElementById("crystalsList");
  var crystalSlots = document.getElementById("crystals").querySelectorAll(".crystal-icon");
  crystalContainer.innerHTML = "";
  var crystalDiv = document.createElement("div");
  crystalDiv.className = "item";
  var setCrystalDiv = document.createElement("div");
  setCrystalDiv.className = "item related-crystals";
  var mainCrystalDiv = document.createElement("div");
  mainCrystalDiv.className = "item related-crystals";
  var activeCrystals = []
  var activeCrystal = activeSlot.getAttribute("data-slot");
  var mainCrystal = "";
  for(var a = 0; a < crystalSlots.length; a++) {
    if(crystalSlots[a].hasAttribute("data-crystal-id")) {
      var crystal = crystalSlots[a].getAttribute("data-crystal-id");
      for(var i = 0; i < crystalList.length; i++) {
        if(crystal == i) {
          if(a == 0) {
            mainCrystal = crystalList[i].data.iname;
          }
          activeCrystals.push(crystalList[i].data.iname);
          break;
        }
      }
    }
  }
  for(var i = 0; i < crystalList.length; i++) {
    if(activeCrystals.length != 0) {
      for(var a = 0; a < activeCrystals.length; a++) {
        var crystalFlag = false;
        if(activeCrystals[a] == crystalList[i].data.iname) { 
          crystalFlag = true;
          break;
        }
      }
      if(crystalFlag) { continue; }
    }
    var crystalEl = document.createElement("div");
    crystalEl.className = "crystal-icon";
    crystalEl.setAttribute("data-crystal-id", i);
    crystalEl.setAttribute("data-rank-id", 4);
    crystalEl.title = crystalList[i].data.name;
    var crystalIcon = document.createElement("div");
    crystalIcon.className = "icon tiny-icon";
    var crystalImg = document.createElement("img");
    crystalImg.src = imgPath + "/images/CrystalIcon/" + crystalList[i].data.icon + ".png";

    crystalIcon.appendChild(crystalImg);
    crystalEl.appendChild(crystalIcon);
    crystalEl.addEventListener("click", function(e) {
      activeSlot.setAttribute("data-crystal-id", this.getAttribute("data-crystal-id"));
      activeSlot.setAttribute("data-rank-id", this.getAttribute("data-rank-id"));
      var myModal = Modal.getInstance(document.getElementById("crystalModal"));
      myModal.hide();
      updateUnit(16);
    });

    var set_check = false;

    if(activeCrystals.length >= 1) {
      if(activeCrystal == 1) {
        if(crystalList[i].data.hasOwnProperty("crystal_sets")) {
          for(var a = 0; a < crystalList[i].data.crystal_sets.length; a++) {
            if(crystalList[i].data.crystal_sets[a].main_crystal == crystalList[i].data.iname) {
              for(var b = 0; b < crystalList[i].data.crystal_sets[a].sub_crystals.length; b++) {
                if(activeCrystals.includes(crystalList[i].data.crystal_sets[a].sub_crystals[b])) {
                  set_check = true;
                  break;
                }
              }
            }
            if(set_check) { break; }
          }
        }
      }
      else {
        if(crystalList[i].data.hasOwnProperty("sub_crystal_sets")) {
          for(var a = 0; a < crystalList[i].data.sub_crystal_sets.length; a++) {
            if(crystalList[i].data.sub_crystal_sets[a].sub_crystals.includes(crystalList[i].data.iname)) {
              if(mainCrystal == crystalList[i].data.sub_crystal_sets[a].main_crystal) {
                set_check = true;
              }
            }
            if(set_check) { break; }
          }
        }
      }
    }

    if(set_check) {
      setCrystalDiv.appendChild(crystalEl);
    }
    else {
      crystalDiv.appendChild(crystalEl);
    }
  }
  if(setCrystalDiv.children.length != 0) {
    var setCrystalHeading = document.createElement("h6");
    setCrystalHeading.append(document.createTextNode("Set Phantom Memories"));
    crystalContainer.appendChild(setCrystalHeading);
    crystalContainer.appendChild(setCrystalDiv);
  }
  if(crystalDiv.children.length != 0) {
    var otherCrystalHeading = document.createElement("h6");
    if(setCrystalDiv.children.length != 0) {
      otherCrystalHeading.className = "mt-3";
    }
    if(setCrystalDiv.children.length != 0) {
      otherCrystalHeading.append(document.createTextNode("Other Phantom Memories"));
    }
    else {
      otherCrystalHeading.append(document.createTextNode("Phantom Memories"));
    }
    crystalContainer.appendChild(otherCrystalHeading);
    crystalContainer.appendChild(crystalDiv);
  }
}

function buildShareLink() {
  var unit = document.getElementById("unitsSelect").value;
  var level = document.getElementById("levelSelect").value;
  var job = document.querySelector("a.job-link.active").getAttribute("data-job-id");

  var buildJson = { };

  buildJson["u"] = unit;
  buildJson["l"] = level;
  buildJson["j"] = job;

  var selectedJobMaster = document.querySelectorAll(".job-master");
  var jobMaster = [];

  for(var a = 0; a < selectedJobMaster.length; a++) {
    jobMaster.push(selectedJobMaster[a].getAttribute("data-job-master"));
  }

  buildJson["jm"] = jobMaster;

  var selectedJobChange = document.querySelectorAll(".job-buttons");
  var jobChange = Array(3).fill(0);
  for(var a = 0; a < jobChange.length; a++) {
    var job = selectedJobChange[a].querySelector(".job-change");
    if(job != null) {
      jobChange[a] = job.getAttribute("data-job-change");
    }
  }

  buildJson["jc"] = jobChange;

  var selectedEnlightenment = document.querySelectorAll(".gate-bg");
  var enlightenment = [];

  for(var a = 0; a < selectedEnlightenment.length; a++) {
    enlightenment.push(selectedEnlightenment[a].getAttribute("data-gate-level"));
  }

  buildJson["en"] = enlightenment;

  var selectedSkills = document.querySelectorAll(".skill-details .skill-details-box");
  var skills = [];
  for(var a = 0; a < selectedSkills.length; a++) {
    skills.push(selectedSkills[a].getAttribute("data-skill"));
  }

  if(skills.length > 0) {
    buildJson["s"] = skills;
  }

  var selectedMasterAbility = document.querySelector(".ma-details .skill-details-box");
  if(selectedMasterAbility) {
    buildJson["ma"] = selectedMasterAbility.getAttribute("data-skill");
  }

  var gearSlots = document.querySelectorAll("#gear .gear-icon");
  var gears = [];

  if(gearSlots[0].hasAttribute("data-gear-id")) {
    var gear1Id = gearSlots[0].getAttribute("data-gear-id");
    var gear1Rank = gearSlots[0].getAttribute("data-rank-id");
    gears.push(gear1Id + "," + gear1Rank);
  }
  if(gearSlots[1].hasAttribute("data-gear-id")) {
    var gear2Id = gearSlots[1].getAttribute("data-gear-id");
    var gear2Rank = gearSlots[1].getAttribute("data-rank-id");
    gears.push(gear2Id + "," + gear2Rank);
  }
  if(gearSlots[2].hasAttribute("data-gear-id")) {
    var gear3Id = gearSlots[2].getAttribute("data-gear-id");
    var gear3Rank = gearSlots[2].getAttribute("data-rank-id");
    gears.push(gear3Id + "," + gear3Rank);
  }

  if(gears.length > 0) {
    buildJson["g"] = gears;
  }

  var cardSlots = document.querySelectorAll("#cardEquipment .card-icon");
  var cards = [];

  if(cardSlots[0].hasAttribute("data-card-id")) {
    var card1Id = cardSlots[0].getAttribute("data-card-id");
    var card1Rank = cardSlots[0].getAttribute("data-limit-break");
    cards.push(card1Id + "," + card1Rank);
  }
  if(cardSlots[1].hasAttribute("data-card-id")) {
    var card2Id = cardSlots[1].getAttribute("data-card-id");
    var card2Rank = cardSlots[1].getAttribute("data-limit-break");
    cards.push(card2Id + "," + card2Rank);
  }

  if(cards.length > 0) {
    buildJson["c"] = cards;
  }

  var runeSlots = document.querySelectorAll("#runes .rune-icon");
  var runeSlotsLength = runeSlots.length;
  var runes = [];

  for(var i = 0; i < runeSlotsLength; i ++) {
    if(runeSlots[i].hasAttribute("data-rune-id")) {
      var runeId = runeSlots[i].getAttribute("data-rune-id");
      var runeStat = runeSlots[i].getAttribute("data-base-stat");
      var runeEnhancement = runeSlots[i].getAttribute("data-enhancement");
      var runeEvoStat = runeSlots[i].getAttribute("data-evo-stat");
      runes.push(runeId + "," + runeStat + "," + runeEnhancement + "," + runeEvoStat);
    }
    else {
      runes.push("");
    }
  }

  if(runes.length > 0) {
    buildJson["r"] = runes;
  }

  var spiritSlot = document.getElementById("spiritGear");

  var spiritEnhancement = spiritSlot.getAttribute("data-enhancement");

  if(spiritEnhancement != 0) {
    buildJson["te"] = spiritEnhancement;
  }

  var bondSkills = document.querySelectorAll(".bond-details-box");
  var bonds = [];
  for(var a = 0; a < bondSkills.length; a++) {
    bonds.push(bondSkills[a].getAttribute("data-level"));
  }

  if(bonds.length > 0) {
    buildJson["b"] = bonds;
  }

  var expSkills = document.querySelectorAll(".expedition");
  var exps = [];
  for(var a = 0; a < expSkills.length; a++) {
    exps.push(expSkills[a].getAttribute("data-active"));
  }

  if(exps.length > 0) {
    buildJson["exp"] = exps;
  }

  if(locale == "jp") {
    var crystalSlots = document.querySelectorAll("#crystals .crystal-icon");
    var crystalSlotsLength = crystalSlots.length;
    var crystals = [];

    for(var i = 0; i < crystalSlotsLength; i ++) {
      if(crystalSlots[i].hasAttribute("data-crystal-id")) {
        var crystalId = crystalSlots[i].getAttribute("data-crystal-id");
        var crystalRank = crystalSlots[i].getAttribute("data-rank-id");
        crystals.push(crystalId + "," + crystalRank);
      }
      else {
        crystals.push("");
      }
    }

    if(crystals.length > 0) {
      buildJson["m"] = crystals;
    }
  }

  var baseURL = [window.location.protocol, "//", window.location.host, window.location.pathname].join("");

  var buildUrl = baseURL + "?build=" + btoa(JSON.stringify(buildJson));

  window.history.replaceState({}, "", buildUrl);
  window.Turbo.navigator.history.replace({ href: buildUrl });
}

function parseShareLink() {
  var parseJson = JSON.parse(atob(getParameter("build")));

  var unitSelect = document.getElementById("unitsSelect");
  if(parseJson.hasOwnProperty("u") && unitSelect.querySelector("option[value='" + parseJson["u"] + "'") != null) {
    unitSelect.value = parseJson["u"];
  }
  else {
    return;
  }

  if(parseJson.hasOwnProperty("l") && !isNaN(parseJson["l"]) && parseJson["l"] <= 99 && parseJson["l"] >= 60) {
    var levelSelect = document.getElementById("levelSelect");
    if(parseJson.hasOwnProperty("en")) {
      var enlightenment = parseJson["en"];
      var levelIncrease = 0;
      for(var a = 0; a < enlightenment.length; a++) {
        if(enlightenment[a] >= 1) {
          levelIncrease += 2;
        }
      }
      if(levelIncrease != 0) {
        var maxLevel = 85 + levelIncrease;
        while(levelSelect.options[levelSelect.options.length - 1].value < maxLevel) {
          var option = document.createElement("option");
          option.text = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
          option.value = parseInt(levelSelect.options[levelSelect.options.length - 1].value) + 1;
          levelSelect.add(option);
        }
      }
    }
    levelSelect.value = parseJson["l"];
  }
  else {
    return;
  }

  if(parseJson.hasOwnProperty("j") && !isNaN(parseJson["j"]) && parseJson["j"] >= 0) {
    unitJob = parseJson["j"];
  }
  else {
    return;
  }

  if(parseJson.hasOwnProperty("jm") && parseJson["jm"].length <= 3) {
    unitJM = parseJson["jm"];
  }

  if(parseJson.hasOwnProperty("jc")) {
    unitJC = parseJson["jc"];
  }

  if(parseJson.hasOwnProperty("s")) {
    unitSkills = parseJson["s"];
  }

  if(parseJson.hasOwnProperty("ma")) {
    unitMA = parseJson["ma"];
  }

  if(parseJson.hasOwnProperty("en")) {
    unitEN = parseJson["en"];
  }

  if(parseJson.hasOwnProperty("g")) {
    var gears = parseJson["g"];

    var gearSlots = document.querySelectorAll("#gear .gear-icon");
    var gear1 = gears[0].split(",");
    
    gearSlots[0].setAttribute("data-gear-id", gear1[0]);
    gearSlots[0].setAttribute("data-rank-id", gear1[1]);

    if(gears.length > 1) {
      var gear2 = gears[1].split(",");
      gearSlots[1].setAttribute("data-gear-id", gear2[0]);
      gearSlots[1].setAttribute("data-rank-id", gear2[1]);
    }

    if(gears.length > 2) {
      var gear3 = gears[2].split(",");
      gearSlots[2].setAttribute("data-gear-id", gear3[0]);
      gearSlots[2].setAttribute("data-rank-id", gear3[1]);
    }
  }

  if(parseJson.hasOwnProperty("c")) {
    var cards = parseJson["c"];

    var cardSlots = document.querySelectorAll("#cardEquipment .card-icon");
    var card1 = cards[0].split(",");
    
    cardSlots[0].setAttribute("data-card-id", card1[0]);
    cardSlots[0].setAttribute("data-limit-break", card1[1]);

    if(cards.length > 1) {
      var card2 = cards[1].split(",");
      cardSlots[1].setAttribute("data-card-id", card2[0]);
      cardSlots[1].setAttribute("data-limit-break", card2[1]);
    }
  }

  if(parseJson.hasOwnProperty("r")) {
    var runes = parseJson["r"];

    var runeSlots = document.querySelectorAll("#runes .rune-icon");
    var runeLength = runes.length;

    for(var i = 0; i < runeLength; i ++) {
      if(runes[i] != "")  {
        var rune = runes[i].split(",");
        runeSlots[i].setAttribute("data-rune-id", rune[0]);
        runeSlots[i].setAttribute("data-base-stat", [rune[1], rune[2]]);
        runeSlots[i].setAttribute("data-enhancement", rune[3]);
        runeSlots[i].setAttribute("data-evo-stat", [rune[4], rune[5], rune[6], rune[7], rune[8], rune[9]]);
      }
    }
  }

  if(parseJson.hasOwnProperty("te")) {
    var spirit = parseJson["te"];
    var spiritSlot = document.getElementById("spiritGear");

    spiritSlot.setAttribute("data-enhancement", spirit);
  }

  if(parseJson.hasOwnProperty("b")) {
    unitBonds = parseJson["b"];
  }

  if(parseJson.hasOwnProperty("exp")) {
    unitEXP = parseJson["exp"];
  }

  if(locale == "jp") {
    if(parseJson.hasOwnProperty("m")) {
      var crystals = parseJson["m"];

      var crystalSlots = document.querySelectorAll("#crystals .crystal-icon");
      var crystalLength = crystals.length;

      for(var i = 0; i < crystalLength; i ++) {
        if(crystals[i] != "")  {
          var crystal = crystals[i].split(",");
          crystalSlots[i].setAttribute("data-crystal-id", crystal[0]);
          crystalSlots[i].setAttribute("data-rank-id", crystal[1]);
        }
      }
    }
  }

  document.getElementById("loading").classList.remove("d-none");
  return new Promise(function (resolve, reject) {
    const request = get("/get-unit", { responseKind: "json", query: { slug: unitSelect.value, locale: locale } });
    request.then((response) => {
      if(response.ok) {
        resolve(response.json);
        document.getElementById("loading").classList.add("d-none");
      }
    });
  }).then(function (data) {
    unitData = data;
    buildUnit();
  });
}

function getParameter(param) {
  return decodeURI(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURI(param).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
};
