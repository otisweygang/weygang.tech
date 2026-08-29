/*
  weygang — portfolio behaviour. Pure static, no build; loaded at the end of <body>.

  This file never sizes or scales anything. The preview's desktop aspect and
  zoom are entirely CSS (aspect-ratio + a cqw-based transform in styles.css).
  JS only builds the card list, toggles windows and tabs, fetches source from
  GitHub, and ticks the clock.
*/


/*
  Content — edit this.

  Every card is one entry: { name, slug, desc, tags, url, repo }. `url` is the
  live site (drives the preview iframe); `repo` is a GitHub URL (drives the
  source browser). Both are optional. `slug` must be unique across all three
  lists — it drives selection and the remembered "last opened" card.
*/

const GITHUB_USERNAME = "YOUR_USERNAME";

// The websites section, shown first and given the most visual weight.
// `repoPrivate` marks a repo that exists but can't be browsed — no source link.
const websites = [
  {
    name: "bonezbizarre.com",
    slug: "bonez",
    desc: "Artist portfolio — painting, photography, installations. Hand-built, no framework.",
    tags: ["HTML", "CSS", "Vanilla JS"],
    url: "https://bonezbizarre.com",
    repo: "https://github.com/otisweygang/bonez",
  },
  {
    name: "icahd.org",
    slug: "icahd",
    desc: "Non-profit site, maintained. Short line about the site and your role on it.",
    tags: ["Maintained"],
    url: "https://icahd.org",
    repoPrivate: true,
  },
  {
    name: "mamba-uk.com",
    slug: "mamba",
    desc: "Business site. Short line about the site and your role on it.",
    tags: ["HTML", "CSS", "Vanilla JS"],
    url: "https://mamba-uk.com",
    repo: "https://github.com/otisweygang/mamba",
  },
  {
    name: "thegentlehand.netlify.app",
    slug: "gentle-hand",
    desc: "Short line about the site and your role on it.",
    tags: ["HTML", "CSS", "JS", "Netlify"],
    url: "https://thegentlehand.netlify.app",
    repo: "https://github.com/otisweygang/atta",
  },
];

// Coding projects, grouped by language.
const codingByLanguage = [
  {
    language: "C",
    entries: [
      {
        name: "hex-editor",
        slug: "hex-editor",
        desc: "Terminal hex editor. ncurses, no deps.",
        tags: ["C", "ncurses"],
        repo: "https://github.com/otisweygang/hex-editor",
      },
    ],
  },
  {
    language: "Go",
    entries: [
      {
        name: "lsp-server",
        slug: "lsp-server",
        desc: "A small language server, for learning the protocol.",
        tags: ["Go", "LSP"],
        repo: "https://github.com/otisweygang/lsp-server",
      },
    ],
  },
];

const cv = {
  name: "cv",
  slug: "cv",
  desc: "One-page CV.",
  tags: ["PDF"],
  url: "./Otis_Weygang_CV.pdf",
};

const DEFAULT_SLUG = "bonez";

function allEntries() {
  return [...websites, ...codingByLanguage.flatMap((group) => group.entries), cv];
}

const entryBySlug = new Map(allEntries().map((entry) => [entry.slug, entry]));


/* DOM + markup helpers */

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`index.html is missing #${id}`);
  return node;
}

function escapeHTML(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (char) => entities[char]);
}

// A trusted fragment that `html` will splice in verbatim instead of escaping.
class SafeHTML {
  constructor(value) {
    this.value = value;
  }
}

// Tagged template that escapes every interpolation. A nested html`` result (or
// an array of them) is spliced in as-is; everything else is escaped. The
// literal parts are indented for readability, so collapse that whitespace —
// the output then matches hand-written markup with no stray text nodes.
function html(strings, ...values) {
  const tidy = (part) => part.replace(/>\s+</g, "><").replace(/\s*\n\s*/g, " ");
  const expand = (value) => {
    if (value instanceof SafeHTML) return value.value;
    if (Array.isArray(value)) return value.map(expand).join("");
    return escapeHTML(value ?? "");
  };
  const body = strings.reduce(
    (acc, str, i) => (i === 0 ? tidy(str) : acc + expand(values[i - 1]) + tidy(str)),
    "",
  );
  return new SafeHTML(body.trim());
}

function render(target, content) {
  target.innerHTML = content instanceof SafeHTML ? content.value : String(content);
}

// "https://github.com/foo/bar" -> "foo/bar", or null if it isn't a repo URL.
function repoSlug(url) {
  const match = url?.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  return match ? match[1] : null;
}

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage disabled or full — the feature just won't persist
  }
}


/*
  The card list down the left side. Websites and Coding projects each lay
  out as a 2-column grid that collapses to one column when space is tight;
  CV is a single full-width card. Selecting a card opens it in the detail
  pane; the last-opened card is remembered in localStorage and reopened on
  the next visit.
*/

const NAV_LAST_KEY = "nav-last"; // slug of the last-opened card

function tagRow(tags) {
  if (!tags?.length) return "";
  return html`<div class="nav-tags">${tags.map((tag) => html`<span class="nav-tag">${tag}</span>`)}</div>`;
}

// The mono hint line under a card: which of live / source it offers.
function affordances(entry) {
  const hints = [
    entry.url && "live",
    entry.repo ? "source" : entry.repoPrivate && "source private",
  ].filter(Boolean);
  return hints.length
    ? html`<div class="nav-card-links">${hints.map((h) => html`<span class="nav-link">${h}</span>`)}</div>`
    : "";
}

// Card titles are domains, so they don't wrap. Step the font size down as the
// name gets longer so a long one still fits on a single line.
function nameSizeStep(name) {
  if (name.length <= 14) return "1";
  if (name.length <= 19) return "0.9";
  if (name.length <= 24) return "0.8";
  return "0.72";
}

function projectCard(entry) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-card";
  button.dataset.slug = entry.slug;
  button.style.setProperty("--name-scale", nameSizeStep(entry.name));
  render(button, html`
    <p class="nav-card-name">${entry.name}</p>
    <p class="nav-card-desc">${entry.desc}</p>
    ${tagRow(entry.tags)}
    ${affordances(entry)}
  `);
  button.addEventListener("click", () => openDetail(entry, button));
  return button;
}

function navSection(title, layout, ...children) {
  const section = document.createElement("section");
  section.className = "nav-group";
  render(section, html`
    <h2 class="nav-group-title">${title}</h2>
    <div class="nav-${layout}"></div>
  `);
  section.querySelector(`.nav-${layout}`).append(...children);
  return section;
}

function languageHeading(language) {
  const heading = document.createElement("h3");
  heading.className = "nav-sub";
  heading.textContent = language;
  return heading;
}

function buildNav() {
  const coding = codingByLanguage.flatMap(({ language, entries }) => [
    languageHeading(language),
    ...entries.map(projectCard),
  ]);

  el("cards").replaceChildren(
    navSection("Websites", "grid", ...websites.map(projectCard)),
    navSection("Coding projects", "grid", ...coding),
    navSection("CV", "column", projectCard(cv)),
  );
  el("list-count").textContent = `${entryBySlug.size} entries`;

  const stored = readStored(NAV_LAST_KEY);
  const slug = entryBySlug.has(stored) ? stored : DEFAULT_SLUG;
  const button = el("cards").querySelector(`.nav-card[data-slug="${CSS.escape(slug)}"]`);
  if (button) openDetail(entryBySlug.get(slug), button);
}


/* Detail pane — open / close / expand */

let currentItem = null;

function openDetail(item, cardNode) {
  currentItem = item;
  sourceShownFor = null;

  for (const selected of document.querySelectorAll(".nav-card.is-selected")) {
    selected.classList.remove("is-selected");
  }
  cardNode?.classList.add("is-selected");
  writeStored(NAV_LAST_KEY, item.slug);

  el("win-detail").hidden = false;
  el("stage").classList.add("is-split"); // CSS slides the window in and resizes everything

  setView("preview");
  renderPreview(item);
}

function closeDetail() {
  const stage = el("stage");
  stage.classList.remove("is-split", "is-wide");
  setTimeout(() => {
    if (!stage.classList.contains("is-split")) el("win-detail").hidden = true;
  }, 320);

  for (const selected of document.querySelectorAll(".nav-card.is-selected")) {
    selected.classList.remove("is-selected");
  }
  currentItem = null;
}

// Expanded: detail takes ~80%, the list shrinks to a thin rail.
function toggleWide() {
  el("stage").classList.toggle("is-wide");
}

// The titlebar path: the live URL while previewing, the repo path while reading source.
function setDetailPath(view) {
  if (!currentItem) return;
  el("detail-path").textContent =
    view === "source"
      ? repoSlug(currentItem.repo) ?? "no repository"
      : String(currentItem.url || "no live site").replace(/^https?:\/\//, "");
}


/* Preview + source views */

function setView(name) {
  for (const tab of document.querySelectorAll(".win-tab")) {
    tab.classList.toggle("is-active", tab.dataset.view === name);
  }

  const body = el("detail-body");
  body.dataset.view = name; // one attribute drives the layout
  if (name !== "source") body.classList.remove("src-full");
  setDetailPath(name);

  if (name === "source" && currentItem && sourceShownFor !== currentItem.slug) {
    openRepoDir(currentItem, ""); // start at the repo root
  }
}

function toggleSourceFull() {
  el("detail-body").classList.toggle("src-full");
}

function renderPreview(item) {
  render(el("detail-body"), html`
    <div class="detail-view view-preview" data-view="preview"></div>
    <div class="detail-view view-source" data-view="source">
      <div class="msg"><p class="line">// open the source tab to load</p></div>
    </div>
  `);

  const view = document.querySelector('.detail-view[data-view="preview"]');

  if (!item.url) {
    showMessage(view, "// no live site for this entry", item, item.repo);
    return;
  }

  render(view, html`
    <div class="screen">
      <div class="screen-scaler">
        <iframe id="preview-frame" title="Preview of ${item.name}"
          src="${item.url}" loading="lazy" referrerpolicy="no-referrer"></iframe>
      </div>
    </div>
  `);

  whenPreviewFails(document.getElementById("preview-frame"), () => {
    showMessage(view, "// remote host refused to embed", item, item.url);
  });
}

// Some hosts silently refuse to be framed: no error event, just a blank iframe.
// Treat "no load event within 2.5s" as a failure too.
function whenPreviewFails(frame, onFail) {
  let loaded = false;
  frame.addEventListener("load", () => (loaded = true));
  frame.addEventListener("error", () => loaded || onFail());
  setTimeout(() => loaded || onFail(), 2500);
}

// The shared fallback card: a mono comment line, the entry name + desc, and a
// link out to whatever destination we do have.
function showMessage(view, line, item, link) {
  view.classList.remove("view-preview"); // drop the preview padding
  const isRepo = link === item.repo;
  render(view, html`
    <div class="msg">
      <p class="line">${line}</p>
      <p class="name">${item.name}</p>
      <p class="desc">${item.desc}</p>
      ${link
        ? html`<a class="go" href="${link}" target="_blank" rel="noopener">${isRepo ? "view source" : "visit"} &nearr;</a>`
        : ""}
    </div>
  `);
}


/*
  The source tab — a browsable repo file tree. Talks to GitHub's public
  REST API straight from the visitor's browser: no server, no token. One
  GET /repos/OWNER/REPO/contents/PATH per folder or file opened — a JSON
  array for a folder, raw text for a file. Public repos only (private ->
  401); ~60 requests/hour per IP, then 403.
*/

let sourceShownFor = null;

// Cache the in-flight promise, not just the result: revisiting a folder or
// walking back up the breadcrumb is then instant and costs no API call.
const repoRequests = new Map();

function fetchRepoPath(repo, path) {
  const key = `${repo}/${path}`;
  if (!repoRequests.has(key)) {
    repoRequests.set(key, requestRepoPath(repo, path).catch((err) => {
      repoRequests.delete(key); // let a failed lookup be retried
      throw err;
    }));
  }
  return repoRequests.get(key);
}

async function requestRepoPath(repo, path) {
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;
  const response = await fetch(url, { headers: { Accept: "application/vnd.github.raw" } });

  if (!response.ok) throw new Error(describeError(response.status));

  // With the `raw` Accept header a file comes back as its plain text, but a
  // directory still comes back as the JSON listing array. Parse and check for
  // the array to tell them apart; anything else is file contents.
  const text = await response.text();
  const listing = tryParseListing(text);
  if (!listing) return { type: "file", text };

  listing.sort(byDirThenName);
  return { type: "dir", entries: listing };
}

function tryParseListing(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) && parsed.every((e) => e && "type" in e && "path" in e)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function describeError(status) {
  if (status === 404) return "not found";
  if (status === 403) return "rate limited — try again in a bit";
  if (status === 401) return "private repo — source not shown";
  return `HTTP ${status}`;
}

function byDirThenName(a, b) {
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

// Only flash a placeholder if the request is actually slow, so cache hits and
// fast responses don't blink.
function withSlowSpinner(promise, showPlaceholder) {
  let settled = false;
  promise.finally(() => (settled = true));
  setTimeout(() => settled || showPlaceholder(), 150);
  return promise;
}

function sourceView() {
  return document.querySelector('.detail-view[data-view="source"]');
}

// The persistent shell: a crumb bar + a swappable body. Built once per source
// render; navigation only replaces .src-body.
function sourceShell() {
  const view = sourceView();
  if (!view) return null;
  if (!view.querySelector(".src-body")) {
    render(view, html`
      <div class="tree-crumbs">
        <span class="crumb-path"></span>
        <button class="src-full-toggle" type="button" aria-label="Expand source pane"></button>
      </div>
      <div class="src-body"></div>
    `);
    view.querySelector(".src-full-toggle").addEventListener("click", toggleSourceFull);
  }
  return view;
}

function renderCrumbs(view, item, repo, path) {
  const bar = view.querySelector(".crumb-path");
  const segments = path ? path.split("/") : [];
  let accum = "";

  render(bar, html`
    <button class="crumb" data-path="">${repo.split("/")[1]}</button>
    ${segments.map((segment) => {
      accum = accum ? `${accum}/${segment}` : segment;
      return html`
        <span class="crumb-sep">/</span>
        <button class="crumb" data-path="${accum}">${segment}</button>
      `;
    })}
  `);

  for (const crumb of bar.querySelectorAll(".crumb")) {
    crumb.addEventListener("click", () => openRepoDir(item, crumb.dataset.path));
  }
  view
    .querySelector(".src-full-toggle")
    .classList.toggle("is-on", el("detail-body").classList.contains("src-full"));
}

// Swap the body with a short cross-fade. `instant` skips it (cache hits).
function setSourceBody(view, content, wire, instant) {
  const body = view.querySelector(".src-body");
  const paint = () => {
    render(body, content);
    wire?.(body);
    body.classList.remove("is-leaving");
  };
  if (instant) return paint();
  body.classList.add("is-leaving");
  setTimeout(paint, 120);
}

function directoryList(entries) {
  return html`
    <div class="tree-list">
      ${entries.map((entry) => {
        const isDir = entry.type === "dir";
        return html`
          <button class="tree-row" data-type="${entry.type}" data-path="${entry.path}">
            <span class="tree-glyph">${isDir ? "▸" : ""}</span>
            <span class="tree-name">${entry.name}${isDir ? "/" : ""}</span>
          </button>
        `;
      })}
    </div>
  `;
}

function wireDirectoryRows(item, body) {
  for (const row of body.querySelectorAll(".tree-row")) {
    row.addEventListener("click", () => {
      if (row.dataset.type === "dir") openRepoDir(item, row.dataset.path);
      else openRepoFile(item, row.dataset.path);
    });
  }
}

function sourceError(item, message) {
  return html`
    <div class="msg">
      <p class="line">// ${message}</p>
      ${item.repo
        ? html`<a class="go" href="${item.repo}" target="_blank" rel="noopener">open repo &nearr;</a>`
        : ""}
    </div>
  `;
}

function loadingMessage(label) {
  return html`<div class="msg"><p class="line">// reading ${label}…</p></div>`;
}

function openRepoDir(item, path) {
  const view = sourceShell();
  if (!view) return;

  const repo = repoSlug(item.repo);
  sourceShownFor = item.slug;

  if (!repo) {
    renderCrumbs(view, item, `${item.slug}/no-repo`, "");
    setSourceBody(view, sourceError(item, "no repository for this entry"), null, true);
    return;
  }

  renderCrumbs(view, item, repo, path);
  const request = fetchRepoPath(repo, path);
  withSlowSpinner(request, () => setSourceBody(view, loadingMessage(`${repo}/${path}`), null, true));

  request
    .then((result) => {
      if (result.type === "file") {
        openRepoFile(item, path);
        return;
      }
      setSourceBody(view, directoryList(result.entries), (body) => wireDirectoryRows(item, body));
    })
    .catch((err) => setSourceBody(view, sourceError(item, err.message), null));
}

function openRepoFile(item, path) {
  const view = sourceShell();
  if (!view) return;

  const repo = repoSlug(item.repo);
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  renderCrumbs(view, item, repo, parent);

  const showCode = (text, instant) =>
    setSourceBody(
      view,
      html`<pre class="source-code"></pre>`,
      (body) => (body.querySelector(".source-code").textContent = text),
      instant,
    );

  const request = fetchRepoPath(repo, path);
  withSlowSpinner(request, () => setSourceBody(view, loadingMessage(path), null, true));

  request
    .then((result) => showCode(result.type === "file" ? result.text : "", false))
    .catch((err) => setSourceBody(view, sourceError(item, err.message), null));
}


/* Theme (dark default, light optional) */

function applyTheme(name) {
  const root = document.documentElement;
  if (name === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
}

function initTheme() {
  applyTheme(readStored("theme") === "light" ? "light" : "dark");

  el("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.hasAttribute("data-theme") ? "dark" : "light";
    applyTheme(next);
    writeStored("theme", next);
  });
}


/* UTC clock */

function tickUTC() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
  el("utc").textContent = `${date} ${time} UTC`;
}


/* Boot */

function boot() {
  initTheme();

  for (const link of document.querySelectorAll(".gh")) {
    link.setAttribute("href", `https://github.com/${GITHUB_USERNAME}`);
  }

  buildNav();

  for (const tab of document.querySelectorAll(".win-tab")) {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  }
  el("detail-close").addEventListener("click", closeDetail);
  el("detail-expand").addEventListener("click", toggleWide);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && currentItem) closeDetail();
  });

  tickUTC();
  setInterval(tickUTC, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
