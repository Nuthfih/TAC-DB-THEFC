import { Controller } from "@hotwired/stimulus"
import Combobox from "combobox-nav"

const TYPE_NAMES = ["Unit", "Gear", "Memento", "Item", "Skill", "Quest", "Truth Seal"];

// Module-level cache for search index data
let enIndexCache = null;
let jpIndexCache = null;
let enIndexPromise = null;
let jpIndexPromise = null;

function getSiteBaseUrl() {
  const brand = document.querySelector('a.navbar-brand');
  if (brand) {
    const href = brand.getAttribute('href') || 'index.html';
    return href.replace(/(index|jp)\.html$/, '');
  }
  return '';
}

function loadScriptIndex(jsUrl, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = jsUrl;
    s.onload = () => resolve(window[globalName] || []);
    s.onerror = () => resolve([]);
    document.head.appendChild(s);
  });
}

function loadSearchIndex(locale) {
  const isJp = locale === 'ja' || locale === 'jp' || window.location.pathname.includes('/jp/') || window.location.pathname.endsWith('/jp.html');
  if (isJp) {
    if (jpIndexCache) return Promise.resolve(jpIndexCache);
    if (window.TAC_SEARCH_INDEX_JP) {
      jpIndexCache = window.TAC_SEARCH_INDEX_JP;
      return Promise.resolve(jpIndexCache);
    }
    if (jpIndexPromise) return jpIndexPromise;
    const baseUrl = getSiteBaseUrl();
    const jsUrl = baseUrl + 'search_index_jp.js';
    if (window.location.protocol === 'file:') {
      jpIndexPromise = loadScriptIndex(jsUrl, 'TAC_SEARCH_INDEX_JP')
        .then(data => { jpIndexCache = data; return data; });
      return jpIndexPromise;
    }
    const url = baseUrl + 'search_index_jp.json';
    jpIndexPromise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('JP Search index HTTP error: ' + res.status);
        return res.json();
      })
      .then(data => {
        jpIndexCache = data;
        return data;
      })
      .catch(() => {
        return loadScriptIndex(jsUrl, 'TAC_SEARCH_INDEX_JP').then(data => {
          jpIndexCache = data;
          return data;
        });
      });
    return jpIndexPromise;
  } else {
    if (enIndexCache) return Promise.resolve(enIndexCache);
    if (window.TAC_SEARCH_INDEX) {
      enIndexCache = window.TAC_SEARCH_INDEX;
      return Promise.resolve(enIndexCache);
    }
    if (enIndexPromise) return enIndexPromise;
    const baseUrl = getSiteBaseUrl();
    const jsUrl = baseUrl + 'search_index.js';
    if (window.location.protocol === 'file:') {
      enIndexPromise = loadScriptIndex(jsUrl, 'TAC_SEARCH_INDEX')
        .then(data => { enIndexCache = data; return data; });
      return enIndexPromise;
    }
    const url = baseUrl + 'search_index.json';
    enIndexPromise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('EN Search index HTTP error: ' + res.status);
        return res.json();
      })
      .then(data => {
        enIndexCache = data;
        return data;
      })
      .catch(() => {
        return loadScriptIndex(jsUrl, 'TAC_SEARCH_INDEX').then(data => {
          enIndexCache = data;
          return data;
        });
      });
    return enIndexPromise;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  const before = text.slice(0, idx);
  const matched = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(matched)}</mark>${escapeHtml(after)}`;
}

function parseItem(item) {
  const name = item[0];
  let url = item[1];
  if (!url.endsWith('.html')) url += '.html';
  let type = item[2];
  if (typeof type === 'number') {
    type = TYPE_NAMES[type] || 'Item';
  }
  return { name, url, type };
}

function searchItems(query, index, maxResults = 12) {
  if (!query || query.trim().length === 0 || !index || index.length === 0) return [];
  const q = query.trim().toLowerCase();
  const qWords = q.split(/\s+/).filter(Boolean);

  const scored = [];

  for (let i = 0; i < index.length; i++) {
    const item = parseItem(index[i]);
    const nameLower = item.name.toLowerCase();
    const fileName = (item.url.split('/').pop() || '').replace('.html', '').toLowerCase();
    const searchable = nameLower + ' ' + fileName + ' ' + fileName.replace(/[-_]/g, ' ');

    // Check query match
    if (!searchable.includes(q)) {
      let allWordsMatch = true;
      for (let w = 0; w < qWords.length; w++) {
        if (!searchable.includes(qWords[w])) {
          allWordsMatch = false;
          break;
        }
      }
      if (!allWordsMatch) continue;
    }

    let score = 100;

    if (nameLower === q) {
      score = 0;
    } else if (nameLower.startsWith(q)) {
      score = 10;
    } else if (nameLower.includes(' ' + q) || nameLower.includes('[' + q) || nameLower.includes('(' + q)) {
      score = 20;
    } else {
      score = 40;
    }

    // Huge bonus for exact slug match (e.g. unit/zahar.html for query "zahar")
    if (fileName === q) {
      score -= 50;
    } else if (fileName.startsWith(q)) {
      score -= 20;
    }

    // Boost priority items (Units, Gears, Mementos, Runes)
    if (item.type === 'Unit') score -= 15;
    else if (item.type === 'Gear') score -= 10;
    else if (item.type === 'Memento') score -= 6;
    else if (item.type === 'Truth Seal') score -= 3;

    // Prefer shorter, more exact titles
    score += Math.min(20, Math.floor(Math.max(0, item.name.length - q.length) / 5));

    scored.push({ item, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, maxResults).map(s => s.item);
}

export default class extends Controller {
  static targets = ["input", "list", "loading"]

  connect() {
    if (this.element.dataset.tacSearchInit === "true") return;
    this.element.dataset.searchManaged = "stimulus";
    // Intercept form submit to prevent navigating to Wayback Machine
    this.element.setAttribute("action", "javascript:void(0)");
    this.element.addEventListener("submit", (e) => {
      e.preventDefault();
      this.navigateToFirstOrSelected();
    });

    // Preload index in background
    const locale = document.body.getAttribute("data-locale") || "en";
    loadSearchIndex(locale);
  }

  disconnect() {
    this.combobox?.destroy();
  }

  listTargetConnected() {
    this.start();
  }

  start() {
    clearTimeout(this.stopTimeout);
    this.combobox?.destroy();

    if (!this.hasInputTarget || !this.hasListTarget) return;

    this.combobox = new Combobox(this.inputTarget, this.listTarget);
    this.combobox.start();

    if (this.inputTarget.value.trim().length === 0 || !this.listTarget.querySelector("li")) {
      this.listTarget.hidden = true;
      this.listTarget.setAttribute("hidden", "");
    } else {
      this.listTarget.hidden = false;
      this.listTarget.removeAttribute("hidden");
    }
  }

  stop() {
    clearTimeout(this.timeout);
    // Slight delay so clicks on suggestions are registered before hiding
    this.stopTimeout = setTimeout(() => {
      this.combobox?.stop();
      if (this.hasListTarget) {
        this.listTarget.hidden = true;
        this.listTarget.setAttribute("hidden", "");
      }
    }, 200);
  }

  link(e) {
    e.preventDefault();
    clearTimeout(this.timeout);
    if (this.hasListTarget) {
      this.listTarget.hidden = true;
    }
    if (e.which === 1) {
      e.target.click();
    }
  }

  updateInput(e) {
    // When Enter is pressed on the input
    e.preventDefault();
    e.stopImmediatePropagation();
    this.navigateToFirstOrSelected();
  }

  disabled(e) {
    if (e) e.preventDefault();
    clearTimeout(this.timeout);
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.add("d-none");
    }
    this.navigateToFirstOrSelected();
  }

  navigateToFirstOrSelected() {
    if (!this.hasListTarget) return;
    const selected = this.listTarget.querySelector('li[aria-selected="true"] a') ||
      this.listTarget.querySelector('li a[role="option"]') ||
      this.listTarget.querySelector('li a');
    if (selected && selected.getAttribute('href')) {
      window.location.href = selected.href;
    }
  }

  result({ target: { value } }) {
    clearTimeout(this.timeout);
    clearTimeout(this.stopTimeout);

    const query = value.trim();

    if (query.length === 0) {
      if (this.hasLoadingTarget) this.loadingTarget.classList.add("d-none");
      if (this.hasListTarget) {
        this.listTarget.innerHTML = "";
        this.listTarget.hidden = true;
      }
      return;
    }

    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.remove("d-none");
    }

    this.timeout = setTimeout(async () => {
      const locale = document.body.getAttribute("data-locale") || "en";
      const index = await loadSearchIndex(locale);

      if (this.hasLoadingTarget) {
        this.loadingTarget.classList.add("d-none");
      }

      // Check if user input changed while loading
      if (this.inputTarget.value.trim() !== query) return;

      const matches = searchItems(query, index, 12);
      const baseUrl = getSiteBaseUrl();

      if (matches.length === 0) {
        this.listTarget.innerHTML = `<li class="p-2 text-muted" role="option" aria-disabled="true"><span class="result-name">No results found</span></li>`;
      } else {
        const html = matches.map(item => {
          const fullUrl = baseUrl + item.url;
          const highlighted = highlightMatch(item.name, query);

          return `<li role="option"><a href="${fullUrl}" role="option"><span class="result-name">${highlighted}</span><span class="result-type">${escapeHtml(item.type)}</span></a></li>`;
        }).join("");
        this.listTarget.innerHTML = html;
      }

      this.start();
    }, 150);
  }
}
