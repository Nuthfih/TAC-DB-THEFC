import { Controller } from "@hotwired/stimulus"
import { get } from "@rails/request.js"
import Combobox from "combobox-nav"

export default class extends Controller {
  static targets = ["input", "list", "loading"]

  disconnect() {
    this.combobox?.destroy();
  }

  listTargetConnected() {
    this.start();
  }

  start() {
    this.combobox?.destroy();

    this.combobox = new Combobox(this.inputTarget, this.listTarget);
    this.combobox.start();
    if(this.inputTarget.value.length == 0 || !this.listTarget.querySelector("li")) {
      this.listTarget.hidden = true;
    }
    else{
      this.listTarget.hidden = false;
    }
  }

  stop() {
    clearTimeout(this.timeout);
    this.combobox?.stop();
    this.listTarget.hidden = true;
  }

  link(e) {
    e.preventDefault();
    clearTimeout(this.timeout);
    this.listTarget.hidden = true;
    if(e.which == 1) {
      e.target.click();
    }
  }

  updateInput(e) {
    e.stopImmediatePropagation();
    this.disabled();
  }

  disabled() {
    clearTimeout(this.timeout);
    this.loadingTarget.classList.add("d-none");
    this.listTarget.hidden = true;
  }

  result({ target: { value } }) {
    clearTimeout(this.timeout);
    this.listTarget.hidden = true;
    this.loadingTarget.classList.add("d-none");
    if(/[\S^\\u3000].+[\S^\\u3000]$/.test(value)) {
      this.loadingTarget.classList.remove("d-none");
      this.timeout = setTimeout(() => {
        const request = get(`/search?s=${value}&locale=${document.body.getAttribute("data-locale")}`, {
          responseKind: "turbo-stream"
        });
        request.then((response) => {
          this.loadingTarget.classList.add("d-none");
          this.listTarget.hidden = false;
        });
      }, 250);
    }
  }
};
