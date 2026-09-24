import { Controller } from "@hotwired/stimulus"
import { Modal } from "bootstrap"

export default class extends Controller {
  static targets = ["form"]

  search() {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.disabled();
      this.formTarget.requestSubmit();
    }, 250);
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
