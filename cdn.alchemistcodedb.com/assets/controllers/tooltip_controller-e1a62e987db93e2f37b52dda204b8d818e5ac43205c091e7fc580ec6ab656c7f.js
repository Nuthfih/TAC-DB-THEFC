import { Controller } from "@hotwired/stimulus"
import "tippy"

export default class extends Controller {
  connect() {
    this.tippyElements.forEach(element => tippy(element, {
      theme: "info"
    }));
  }

  get tippyElements() {
    return document.querySelectorAll("[data-tippy-content]");
  }
};
