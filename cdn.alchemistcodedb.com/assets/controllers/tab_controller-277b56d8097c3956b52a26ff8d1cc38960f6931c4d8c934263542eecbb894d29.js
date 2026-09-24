import { Controller } from "@hotwired/stimulus"
import { Tab } from "bootstrap"

export default class extends Controller {
  connect() {
    const triggerTabList = document.querySelectorAll("a[data-bs-toggle='list'], a[data-bs-toggle='tab']");
    triggerTabList.forEach(triggerEl => {
      const tabTrigger = new Tab(triggerEl);

      function clickTab(e) {
        e.preventDefault();
        var tab = triggerEl.getAttribute("data-bs-target").substring(1);
        var currentTab = triggerEl.getAttribute("data-bs-target");
        var toggle = triggerEl.getAttribute("data-bs-toggle");
        if(tab == "jobs") {
          tabTrigger.show();
          var firstTab = document.querySelector("#jobTabs li:first-child a");
          Tab.getInstance(firstTab).show();
          currentTab = firstTab.getAttribute("data-bs-target");
        }
        else if(tab == "equipment") {
          tabTrigger.show();
          var firstTab = document.querySelector("#equipmentTabs li:first-child a");
          Tab.getInstance(firstTab).show();
          currentTab = firstTab.getAttribute("data-bs-target");
        }
        else if(tab == "enlightenment") {
          tabTrigger.show();
          var firstTab = document.querySelector("#enlightenmentTabs li:first-child a");
          Tab.getInstance(firstTab).show();
          currentTab = firstTab.getAttribute("data-bs-target");
        }
        else {
          tabTrigger.show();
        }
        if(toggle == "list") {
          document.getElementById(tab).scrollIntoView({block: "start"});
        }
        if (history.replaceState) {
          history.replaceState(history.state, "", currentTab);
        }
        else {
          location.hash = currentTab;
        }
      }
      triggerEl.addEventListener("click", clickTab);
    });

    const jobIconList = document.querySelectorAll(".job-tab");
    jobIconList.forEach(jobIconEl => {
      function clickIcon(e) {
        e.preventDefault();
        var jobTab = jobIconEl.getAttribute("href");
        var mainTab = document.querySelector("a[data-bs-target='#jobs']");
        Tab.getInstance(mainTab).show();
        var currentTab = document.querySelector("a[data-bs-target='" + jobTab + "']");
        Tab.getInstance(currentTab).show();
        document.getElementById("jobs").scrollIntoView({block: "start"});
        if (history.replaceState) {
          history.replaceState(history.state, "", jobTab);
        }
        else {
          location.hash = currentTab;
        }
      }
      jobIconEl.addEventListener("click", clickIcon);
    });

    if(location.hash) {
      if(location.hash.includes("equipment")) {
        var mainTab = document.querySelector("a[data-bs-target='#equipment']");
        Tab.getInstance(mainTab).show();
      }
      else if(location.hash.includes("gate")) {
        var mainTab = document.querySelector("a[data-bs-target='#enlightenment']");
        Tab.getInstance(mainTab).show();
      }
      else if(location.hash.startsWith("#j")) {
        var mainTab = document.querySelector("a[data-bs-target='#jobs']");
        Tab.getInstance(mainTab).show();
      }
      var currentTab = document.querySelector("a[data-bs-target='" + location.hash + "']");
      Tab.getInstance(currentTab).show();
    }
    window.addEventListener("hashchange", hashChange);
  }

  disconnect() {
    const triggerTabList = document.querySelectorAll("a[data-bs-toggle='list'], a[data-bs-toggle='tab']");
    triggerTabList.forEach(triggerEl => {
      triggerEl.removeEventListener("click", clickTab);
    });

    const jobIconList = document.querySelectorAll(".job-tab");
    jobIconList.forEach(jobIconEl => {
      jobIconEl.removeEventListener("click", clickIcon);
    });

    window.removeEventListener("hashchange", hashChange);
  }
}

function hashChange(e) {
  var oldUrlHash = new URL(e.oldURL).hash;
  var newUrlHash = new URL(e.newURL).hash;
  if(oldUrlHash == "" && newUrlHash == "") { return; }
  if(newUrlHash != "") {
    if(newUrlHash.includes("equipment")) {
      var mainTab = document.querySelector("a[data-bs-target='#equipment']");
      Tab.getInstance(mainTab).show();
    }
    else if(newUrlHash.includes("gate")) {
      var mainTab = document.querySelector("a[data-bs-target='#enlightenment']");
      Tab.getInstance(mainTab).show();
    }
    else if(newUrlHash.startsWith("#j")) {
      var mainTab = document.querySelector("a[data-bs-target='#jobs']");
      Tab.getInstance(mainTab).show();
    }
    var currentTab = document.querySelector("a[data-bs-target='" + newUrlHash + "']");
    Tab.getInstance(currentTab).show();
  }
  else {
    var mainTab = document.querySelector("a[data-bs-target='#stats']");
    Tab.getInstance(mainTab).show();
  }
};
