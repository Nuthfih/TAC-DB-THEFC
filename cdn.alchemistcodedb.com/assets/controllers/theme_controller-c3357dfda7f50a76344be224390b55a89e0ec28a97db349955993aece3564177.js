import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    setTheme(getPreferredTheme());
    const theme = document.body.getAttribute("data-bs-theme");
    showActiveTheme(theme, false);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updatePreferredTheme);
  }

  disconnect() {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", updatePreferredTheme);
  }

  updateTheme(e) {
    e.preventDefault();
    const theme = e.currentTarget.getAttribute("data-bs-theme-value");
    setStoredTheme(theme);
    setTheme(theme);
    showActiveTheme(theme, true);
  }
}

const getStoredTheme = () => localStorage.getItem("theme");
const setStoredTheme = theme => localStorage.setItem("theme", theme);

const setTheme = theme => {
  document.body.className = "";
  if (theme == "auto") {
    document.body.classList.add((window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    document.body.setAttribute("data-bs-theme", (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }
  else {
    document.body.classList.add(theme);
    document.body.setAttribute("data-bs-theme", theme);
  }
}

const getPreferredTheme = () => {
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const updatePreferredTheme = () => {
  const storedTheme = getStoredTheme()
  if (storedTheme != "light" && storedTheme != "dark") {
    setTheme(getPreferredTheme());
  }
}

const showActiveTheme = (theme, focus = false) => {
  const themeSwitcher = document.querySelector("#themeDropDown");

  if (!themeSwitcher) {
    return;
  }

  const activeThemeIcon = document.querySelector("#themeDropDown i");
  const btnToActive = document.querySelector("[data-bs-theme-value='" + theme + "']");

  document.querySelectorAll("a[data-bs-theme-value] .fa-check").forEach(iconEl => {
    iconEl.classList.add("d-none");
  });

  btnToActive.querySelector(".fa-check").classList.remove("d-none");
  activeThemeIcon.className = btnToActive.querySelector("i").classList.toString();
  activeThemeIcon.classList.remove("fa-fw", "me-2");

  if (focus) {
    themeSwitcher.focus();
  }
};
