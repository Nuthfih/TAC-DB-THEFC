import { Controller } from "@hotwired/stimulus"
import { Modal } from "bootstrap"

export default class extends Controller {
  static targets = ["form"]

  connect() {
    if (this.hasFormTarget) {
      this.formTarget.setAttribute("action", "javascript:void(0);");
      this.formTarget.addEventListener("submit", (e) => e.preventDefault());
    }
  }

  search(e) {
    if (e) e.preventDefault();
    clearTimeout(this.timeout);
  }

  updateInput() {
    this.disabled();
  }

  updateSort() {
    this.hideModal(document.getElementById("sortModal"));
  }

  disabled() {
    this.element.querySelectorAll("input, select").forEach(el => {
      if(el.value == "") {
        el.disabled = true;
      }
    });
  }

  enabled() {
    this.element.querySelectorAll("input, select, button").forEach(el => {
      el.disabled = false;
    });
    if(document.body.classList.contains("modal-open")) {
      this.hideModal(document.getElementById("filtersModal"));
    }
  }

  resetScroll() {
    var listing = document.getElementById("index_listing");
    listing.scrollIntoView();
  }

  hideModal(modalEl) {
    Modal.getInstance(modalEl).hide();
    modalEl.removeAttribute("aria-modal");
    modalEl.setAttribute("aria-hidden", true);
    modalEl.style = "display: none";
    document.querySelector(".modal-backdrop").remove();
    document.body.classList.remove("modal-open");
    document.body.style = "";
  }
};
