import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["hideable"]

  toggleTargets(e) {
    e.preventDefault();
    this.hideableTargets.forEach((el) => {
      el.hidden = !el.hidden;
    });
    if(e.target.innerHTML == "[+]") {
      e.target.innerHTML = "[-]";
    }
    else {
      e.target.innerHTML = "[+]"
    }
  }

  toggleRows(e) {
    e.preventDefault();
    this.hideableTargets.forEach((el) => {
      el.hidden = !el.hidden;
    });
    if(e.target.innerHTML == "Show More") {
      e.target.innerHTML = "Show Less";
    }
    else {
      e.target.innerHTML = "Show More";
    }
  }

  toggleText(e) {
    var collapseText = e.target.getAttribute("data-text");
    if(e.target.innerHTML.startsWith("Show")) {
      e.target.innerHTML = "Hide " + collapseText;
    }
    else {
      e.target.innerHTML = "Show " + collapseText;
    }
  }

  toggleTabs(e) {
    const mainList = document.querySelectorAll(".main-collapse");
    mainList.forEach(mainEl => {
      if(!mainEl.classList.contains("show")) {
        const childList = mainEl.querySelectorAll("a[aria-expanded='true']");
        childList.forEach(childEl => {
          childEl.click();
        });
      }
    });
    var triggerTab = document.getElementById("it" + e.target.getAttribute("data-insp-skill"));
    var skillTab = document.getElementById("is" + e.target.getAttribute("data-insp-skill"));
    if(!triggerTab.classList.contains("active")) {
      const triggerTabList = document.querySelectorAll("#triggerTabsContent .tab-pane");
      triggerTabList.forEach(triggerEl => {
        triggerEl.classList.remove("show", "active");
        triggerTab.classList.add("show", "active");
      });
    }
    if(!skillTab.classList.contains("active")) {
      const skillTabList = document.querySelectorAll("#inspTabsContent .tab-pane");
      skillTabList.forEach(skillEl => {
        skillEl.classList.remove("show", "active");
        skillTab.classList.add("show", "active");
      });
    }
  }
};
