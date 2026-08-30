/*
  weygang — portfolio behaviour. Pure static, no build; loaded at the end of <body>.

  This file never sizes or scales anything. The preview's desktop aspect and
  zoom are entirely CSS (aspect-ratio + a cqw-based transform in styles.css).
  JS only builds the card list, toggles windows and tabs, fetches source from
  GitHub, and ticks the clock.
*/


/*
  Content — edit this.

  Each entry: { name, slug, what, desc, tags, url, repo }.
    what : a three-or-four word plain-English label ("Artist portfolio site")
    desc : the fuller line shown once a card is selected
    url  : the live site — drives the preview iframe
    repo : a GitHub URL — drives the source browser
  `url` and `repo` are optional; `repoPrivate: true` marks a repo that exists
  but can't be browsed. `slug` must be unique across every group.

  Groups are listed top to bottom in `nav` below.

  `logo` (websites only) is a path under assets/logos/. It's shown on a light
  lockup panel at the top of the card, so a dark or a colour logo both read.
  Cards without a `logo` (tools, CV) show no panel — just name and "what".
*/

const GITHUB_USERNAME = "otisweygang";

const websites = [
  {
    name: "bonezbizarre.com",
    slug: "bonez",
    what: "Static artist portfolio",
    desc: "Artist portfolio — painting, photography, installations. Hand-built, no framework.",
    tags: ["JS", "HTML", "CSS"],
    url: "https://bonezbizarre.com",
    repo: "https://github.com/otisweygang/bonez",
    logo: "./assets/logos/bonez-bizarre-logo.svg",
  },
  {
    name: "icahd.org",
    slug: "icahd",
    what: "Human rights landing site",
    desc: "Non-profit site I maintain. Short line about the site and your role on it.",
    tags: ["Astro", "TS", "HTML", "CSS"],
    url: "https://icahd.org",
    repoPrivate: true,
    logo: "./assets/logos/icahd-logo.svg",
  },
  {
    name: "mamba-uk.com",
    slug: "mamba",
    what: "Static artist portfolio",
    desc: "Business site, hand-built. Short line about the site and your role on it.",
    tags: ["JS", "HTML", "CSS"],
    url: "https://mamba-uk.com",
    repo: "https://github.com/otisweygang/mamba",
    logo: "./assets/logos/mamba-logo.png",
  },
  {
    name: "thegentlehand.netlify.app",
    slug: "gentle-hand",
    what: "Feature film landing site",
    desc: "Small site, built and deployed on Netlify. Short line about your role on it.",
    tags: ["JS", "HTML", "CSS"],
    url: "https://thegentlehand.netlify.app",
    repo: "https://github.com/otisweygang/atta",
    logo: "./assets/logos/atta-palio-films-logo.png",
  },
];

const tools = [
  {
    name: "Site Probe",
    slug: "siteprobe",
    what: "Concurrent URL health checker",
    desc: "CLI that checks a list of URLs concurrently and prints a table of HTTP status codes and response times. Go standard library only, no dependencies.",
    tags: ["Go", "CLI", "stdlib"],
    repo: "https://github.com/otisweygang/siteprobe",
  },
];

const cv = {
  name: "CV",
  slug: "cv",
  what: "One-page CV",
  desc: "One-page CV (PDF).",
  tags: ["PDF"],
  url: "./assets/Otis_Weygang_CV_redacted.pdf",
};

// Top to bottom: the sections of the landing view. `heading` labels each grid.
const nav = [
  { heading: "Websites", entries: websites },
  { heading: "Projects", entries: tools },
  { heading: "CV", entries: [cv] },
];

const entryBySlug = new Map(nav.flatMap((group) => group.entries).map((e) => [e.slug, e]));


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
  The nav is the landing view: on load it fills the whole page. A short
  intro (name + tagline) sits above one section per `nav` group.
  A website card leads with its logo on a light lockup panel; cards without
  a logo (tools, CV) are just the name and a short "what it is" line.
  Picking a card adds `.is-split` to the stage: the grid becomes a single
  left-hand column and the preview slides in. Closing it returns here.
*/

const NAV_HELLO = "Otis Weygang.";
const NAV_PROMPT = "Work, projects, and things I've made.";

function galleryCard(entry) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "nav-card";
  card.dataset.slug = entry.slug;
  render(card, html`
    ${entry.logo
      ? html`<span class="nav-card-logo"><img src="${entry.logo}" alt="${entry.name} logo" loading="lazy" /></span>`
      : ""}
    <span class="nav-card-body">
      <span class="nav-card-name">${entry.name}</span>
      <span class="nav-card-what">${entry.what}</span>
      ${entry.tags?.length
        ? html`<span class="nav-card-tags">${entry.tags.map(
            (tag) => html`<span class="tag">${tag}</span>`,
          )}</span>`
        : ""}
    </span>
  `);
  card.addEventListener("click", () => openDetail(entry, card));
  return card;
}

function navGroup({ heading, entries }) {
  const group = document.createElement("section");
  group.className = "nav-group";
  render(group, html`
    <h2 class="nav-group-title">${heading}</h2>
    <div class="nav-grid"></div>
  `);
  group.querySelector(".nav-grid").append(...entries.map(galleryCard));
  return group;
}

function buildNav() {
  const intro = document.createElement("header");
  intro.className = "nav-intro";
  render(intro, html`
    <p class="nav-hello">${NAV_HELLO}</p>
    <p class="nav-prompt">${NAV_PROMPT}</p>
  `);

  el("cards").replaceChildren(intro, ...nav.map(navGroup));
  el("list-count").textContent = `${entryBySlug.size} entries`;
  fitCardNames();
}

// The card header is a URL and must stay on one line. CSS can't size-to-fit,
// so step the font down (from the stylesheet's 1rem) until it no longer wraps.
// Re-run on resize since the column width changes with the viewport.
function fitCardNames() {
  for (const name of document.querySelectorAll(".nav-card-name")) {
    name.style.fontSize = "";
    let px = parseFloat(getComputedStyle(name).fontSize);
    const oneLine = name.clientHeight;
    while (name.scrollWidth > name.clientWidth && px > 9) {
      px -= 0.5;
      name.style.fontSize = `${px}px`;
    }
    // guard against a wrap the width check misses on sub-pixel rounding
    if (name.scrollHeight > oneLine + 1 && px > 9) name.style.fontSize = `${px - 1}px`;
  }
}

let fitPending = false;
window.addEventListener("resize", () => {
  if (fitPending) return;
  fitPending = true;
  requestAnimationFrame(() => {
    fitPending = false;
    fitCardNames();
  });
});


/* Detail pane — open / close / expand */

let currentItem = null;

function openDetail(item, cardNode) {
  currentItem = item;
  sourceShownFor = null;

  for (const selected of document.querySelectorAll(".nav-card.is-selected")) {
    selected.classList.remove("is-selected");
  }
  cardNode?.classList.add("is-selected");

  el("win-detail").hidden = false;
  el("stage").classList.add("is-split"); // grid collapses to a rail, preview slides in
  setTimeout(fitCardNames, 340); // re-fit once the rail has finished narrowing

  // A website opens on its live preview. A code-only project has nothing to
  // frame, so it opens straight into the source split — README rendered on
  // top, the file tree below.
  renderPreview(item);
  setView(item.url ? "preview" : "source");
}

// Back to the full-page landing grid.
function closeDetail() {
  const stage = el("stage");
  stage.classList.remove("is-split", "is-wide");
  setTimeout(() => {
    if (!stage.classList.contains("is-split")) el("win-detail").hidden = true;
    fitCardNames(); // grid is back to full width — re-fit the headers
  }, 320);

  for (const selected of document.querySelectorAll(".nav-card.is-selected")) {
    selected.classList.remove("is-selected");
  }
  currentItem = null;
}

// Expanded: detail takes ~80%, the list shrinks to a thin rail.
function toggleWide() {
  el("stage").classList.toggle("is-wide");
  setTimeout(fitCardNames, 340);
}

// The titlebar path: while previewing, the live URL — or README.md for a
// code-only project. While reading source, the repo path.
function setDetailPath(view) {
  if (!currentItem) return;
  el("detail-path").textContent =
    view === "source"
      ? repoSlug(currentItem.repo) ?? "no repository"
      : currentItem.url
        ? currentItem.url.replace(/^https?:\/\//, "")
        : currentItem.repo
          ? `${repoSlug(currentItem.repo)}/README.md`
          : "no live site";
}


/* Preview + source views */

function setView(name) {
  for (const tab of document.querySelectorAll(".win-tab")) {
    tab.classList.toggle("is-active", tab.dataset.view === name);
  }
  // the top pane frames a live site for a website, or renders the README for
  // a code-only project — label the tab for what it actually shows
  const top = document.querySelector('.win-tab[data-view="preview"]');
  if (top) top.textContent = currentItem && !currentItem.url ? "readme" : "preview";
  // the source browser needs a repo — hide its tab for entries without one
  const srcTab = document.querySelector('.win-tab[data-view="source"]');
  if (srcTab) srcTab.hidden = !currentItem?.repo;

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

  // No live site: show the repo's README, rendered, in place of the frame.
  if (!item.url) {
    if (item.repo) renderReadme(view, item);
    else showMessage(view, "// no live site for this entry", item, null);
    return;
  }

  // A PDF fills the pane as a plain document. Ask the built-in viewer to start
  // with its side panel (the thumbnail/bookmark "hamburger") collapsed —
  // Chrome reads #navpanes/#pagemode, other viewers ignore the fragment.
  if (/\.pdf($|[?#])/i.test(item.url)) {
    view.classList.add("has-doc");
    render(view, html`
      <iframe id="preview-frame" class="doc-frame" title="Preview of ${item.name}"
        src="${item.url}#pagemode=none&navpanes=0" referrerpolicy="no-referrer"></iframe>
    `);
    whenPreviewFails(document.getElementById("preview-frame"), () => {
      showMessage(view, "// could not display this PDF", item, item.url);
    });
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

// Pull OWNER/REPO's README via the dedicated endpoint (case-insensitive,
// finds README.md / .markdown / .rst) and drop it in rendered.
function renderReadme(view, item) {
  const repo = repoSlug(item.repo);
  view.classList.add("has-readme"); // swap the frame-centring box for a scroll box
  render(view, html`<div class="readme"><div class="msg"><p class="line">// reading README…</p></div></div>`);
  const target = view.querySelector(".readme");

  const key = `${repo}/__readme__`;
  if (!repoRequests.has(key)) {
    repoRequests.set(
      key,
      fetch(`https://api.github.com/repos/${repo}/readme`, {
        headers: { Accept: "application/vnd.github.raw" },
      }).then((r) => {
        if (!r.ok) throw new Error(describeError(r.status));
        return r.text();
      }).catch((err) => {
        repoRequests.delete(key);
        throw err;
      }),
    );
  }

  repoRequests
    .get(key)
    .then((text) => render(target, html`<article class="md">${renderMarkdown(text)}</article>`))
    .catch((err) =>
      render(target, sourceError(item, `README — ${err.message}`)),
    );
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
        <button class="src-icon src-full-toggle" type="button" aria-label="Expand source pane">
          <svg class="ic ic-grow" width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20V4M12 4l-5 5M12 4l5 5" />
          </svg>
          <svg class="ic ic-shrink" width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4v16M12 20l-5-5M12 20l5-5" />
          </svg>
        </button>
        <button class="src-icon src-close" type="button" aria-label="Close source pane">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div class="src-body"></div>
    `);
    view.querySelector(".src-full-toggle").addEventListener("click", toggleSourceFull);
    view.querySelector(".src-close").addEventListener("click", () => setView("preview"));
  }
  return view;
}

// `path` is the directory chain of clickable crumbs; `file`, when given, is
// appended as a plain non-clickable leaf so an open file shows in the trail.
function renderCrumbs(view, item, repo, path, file) {
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
    ${file
      ? html`<span class="crumb-sep">/</span><span class="crumb crumb-file">${file}</span>`
      : ""}
  `);

  for (const crumb of bar.querySelectorAll("button.crumb")) {
    crumb.addEventListener("click", () => openRepoDir(item, crumb.dataset.path));
  }
  // the toggle's lit/glyph state is pure CSS off .detail-body.src-full
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
  const slash = path.lastIndexOf("/");
  const parent = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);
  renderCrumbs(view, item, repo, parent, name);

  const lang = languageFor(name);
  const showCode = (text, instant) =>
    setSourceBody(view, codeBlock(text, lang), null, instant);

  const request = fetchRepoPath(repo, path);
  withSlowSpinner(request, () => setSourceBody(view, loadingMessage(path), null, true));

  request
    .then((result) => showCode(result.type === "file" ? result.text : "", false))
    .catch((err) => setSourceBody(view, sourceError(item, err.message), null));
}


/*
  Syntax highlighting — a small hand-rolled tokenizer, no library, no build.
  It's deliberately approximate: one regex sweep per line, a shared grammar
  for the C-like languages the repos here actually use (JS/TS, Go, C), plus
  dedicated passes for HTML, CSS, JSON, Markdown and shell. Good enough to
  read by; not a parser. Everything is escaped as it's wrapped in spans.

  Palette (the .tok-* classes) lives in styles.css and follows VS Code's
  default dark/light roles: comment, keyword, string, number, function,
  and a couple of markup-only ones (tag, attr).
*/

const EXT_LANG = {
  js: "clike", jsx: "clike", mjs: "clike", cjs: "clike",
  ts: "clike", tsx: "clike",
  go: "clike", c: "clike", h: "clike", java: "clike", rs: "clike",
  css: "css", scss: "css", less: "css",
  html: "markup", htm: "markup", xml: "markup", svg: "markup", vue: "markup",
  json: "json",
  md: "markdown", markdown: "markdown",
  sh: "shell", bash: "shell", zsh: "shell",
  yml: "yaml", yaml: "yaml",
};

function languageFor(filename) {
  const dot = filename.lastIndexOf(".");
  const ext = dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
  if (EXT_LANG[ext]) return EXT_LANG[ext];
  if (/^(Dockerfile|Makefile)$/i.test(filename)) return "shell";
  return "plain";
}

const CLIKE_KEYWORDS = new Set(
  ("const let var function return if else for while do switch case break continue " +
   "new class extends super this typeof instanceof in of void delete yield await async " +
   "try catch finally throw import export from as default static get set " +
   "func package type struct interface map chan go defer select range fallthrough " +
   "int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 " +
   "string bool byte rune error nil true false null undefined " +
   "public private protected void short long double char unsigned signed sizeof " +
   "struct union enum extern register volatile goto").split(" "),
);

// Wrap each match of `re` in <span class="tok-CLASS">, escaping the text.
// Non-matching gaps are escaped verbatim. `classify` may return null to skip.
function paint(line, re, classify) {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(re)) {
    out += escapeHTML(line.slice(last, m.index));
    const cls = classify(m);
    out += cls ? `<span class="tok-${cls}">${escapeHTML(m[0])}</span>` : escapeHTML(m[0]);
    last = m.index + m[0].length;
  }
  return out + escapeHTML(line.slice(last));
}

const HIGHLIGHTERS = {
  plain: (line) => escapeHTML(line),

  clike: (line) => {
    // One alternation so earlier groups (comments, strings) win over later
    // ones (a `//` inside a string must not start a comment, etc.).
    const re =
      /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;
    return paint(line, re, (m) => {
      if (m[1]) return "comment";
      if (m[2]) return "string";
      if (m[3]) return "number";
      if (m[4]) return CLIKE_KEYWORDS.has(m[4]) ? "keyword" : "function";
      if (m[5]) return CLIKE_KEYWORDS.has(m[5]) ? "keyword" : null;
      return null;
    });
  },

  css: (line) => {
    const re =
      /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr|ch|cqw|cqh|dvh)?\b)|(@[\w-]+|--[\w-]+)|([.#]?-?[A-Za-z_][\w-]*)(?=\s*[:{(])/g;
    return paint(line, re, (m) => {
      if (m[1]) return "comment";
      if (m[2]) return "string";
      if (m[3]) return "number";
      if (m[4]) return "keyword";
      if (m[5]) return "function";
      return null;
    });
  },

  markup: (line) => {
    const re = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w-]*)|([A-Za-z-]+)(?==)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\/?>)/g;
    return paint(line, re, (m) => {
      if (m[1]) return "comment";
      if (m[2]) return "tag";
      if (m[3]) return "attr";
      if (m[4]) return "string";
      if (m[5]) return "tag";
      return null;
    });
  },

  json: (line) => {
    const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d[\d.eE+-]*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
    return paint(line, re, (m) => {
      if (m[1]) return m[2] ? "attr" : "string";
      if (m[3]) return "number";
      if (m[4]) return "keyword";
      return null;
    });
  },

  yaml: (line) => {
    const re = /(#[^\n]*)|(^\s*[A-Za-z_][\w-]*)(?=:)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b-?\d[\d.]*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
    return paint(line, re, (m) => {
      if (m[1]) return "comment";
      if (m[2]) return "attr";
      if (m[3]) return "string";
      if (m[4]) return "number";
      if (m[5]) return "keyword";
      return null;
    });
  },

  shell: (line) => {
    const re = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\w+|\$\{[^}]*\})|(^\s*[A-Za-z_][\w-]*)(?==)/g;
    return paint(line, re, (m) => {
      if (m[1]) return "comment";
      if (m[2]) return "string";
      if (m[3]) return "keyword";
      if (m[4]) return "attr";
      return null;
    });
  },

  markdown: (line) => {
    if (/^\s{0,3}#{1,6}\s/.test(line)) return `<span class="tok-keyword">${escapeHTML(line)}</span>`;
    if (/^\s{0,3}(?:[-*+]|\d+\.)\s/.test(line)) {
      const m = line.match(/^(\s*)([-*+]|\d+\.)(\s.*)$/);
      if (m) return escapeHTML(m[1]) + `<span class="tok-keyword">${escapeHTML(m[2])}</span>` + mdInline(m[3]);
    }
    if (/^\s*>/.test(line)) return `<span class="tok-comment">${escapeHTML(line)}</span>`;
    return mdInline(line);
  },
};

function mdInline(text) {
  return paint(
    text,
    /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\[[^\]]+\]\([^)]+\))/g,
    (m) => (m[1] ? "string" : m[2] ? "function" : m[3] ? "tag" : null),
  );
}

// Highlight `text` as `lang`, one <span class="code-line"> per line.
function highlightLines(text, lang) {
  const highlight = HIGHLIGHTERS[lang] || HIGHLIGHTERS.plain;
  return new SafeHTML(
    text
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => `<span class="code-line">${highlight(line) || " "}</span>`)
      .join(""),
  );
}

// The file viewer: a line-number gutter beside the highlighted source. Each
// line is its own row so numbers and code always align.
function codeBlock(text, lang) {
  const lines = text.replace(/\n$/, "").split("\n");
  return html`
    <div class="code" style="--gutter-ch: ${String(lines.length).length}">
      <div class="code-gutter">${new SafeHTML(
        lines.map((_, i) => `<span>${i + 1}</span>`).join(""),
      )}</div>
      <pre class="code-text">${highlightLines(text, lang)}</pre>
    </div>
  `;
}

// A bare highlighted block — no gutter — for fenced code inside a README.
function codeSnippet(text, lang) {
  return html`<pre class="code-snippet"><code>${highlightLines(text, lang)}</code></pre>`;
}


/*
  Markdown → HTML for the README preview. A deliberately small block parser:
  ATX headings, fenced and indented code, unordered/ordered lists (one level),
  blockquotes, thematic breaks, tables, and paragraphs. Inline: code spans,
  bold, italic, links, images, autolinks. Everything is escaped; only the
  tags this function emits are ever inserted.
*/

function mdInlineHTML(text) {
  // Escape first, then re-introduce only our own markup.
  let s = escapeHTML(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy" />`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_, label, href) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`);
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, (_, pre, t) => `${pre}<em>${t}</em>`);
  s = s.replace(/(^|[^_])_([^_\s][^_]*?)_/g, (_, pre, t) => `${pre}<em>${t}</em>`);
  return new SafeHTML(s);
}

function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const flushList = (items, ordered) => {
    const tag = ordered ? "ol" : "ul";
    out.push(`<${tag}>${items.map((it) => `<li>${mdInlineHTML(it).value}</li>`).join("")}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // fenced code
    const fence = line.match(/^\s*(```+|~~~+)\s*([\w-]*)/);
    if (fence) {
      const close = fence[1][0];
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(close)) buf.push(lines[i++]);
      i++; // skip closing fence
      out.push(codeSnippet(buf.join("\n"), languageFor(`x.${fence[2] || "txt"}`)).value);
      continue;
    }

    // ATX heading
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${mdInlineHTML(h[2]).value}</h${lvl}>`);
      i++;
      continue;
    }

    // thematic break
    if (/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(line)) { out.push("<hr />"); i++; continue; }

    // blockquote (fold consecutive > lines)
    if (/^\s{0,3}>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s{0,3}>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(buf.join("\n"))}</blockquote>`);
      continue;
    }

    // table: a header row followed by a |---|---| separator
    if (line.includes("|") && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1] || "")) {
      const row = (l) => l.replace(/^\s*\|?|\|?\s*$/g, "").split("|").map((c) => c.trim());
      const head = row(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes("|")) body.push(row(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${mdInlineHTML(c).value}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${mdInlineHTML(c).value}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
      continue;
    }

    // list (one level; consecutive items of the same kind)
    const li = line.match(/^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) {
          // a plain indented continuation line joins the previous item
          if (items.length && /^\s{2,}\S/.test(lines[i])) { items[items.length - 1] += " " + lines[i].trim(); i++; continue; }
          break;
        }
        items.push(m[2]);
        i++;
      }
      flushList(items, ordered);
      continue;
    }

    // indented code block
    if (/^ {4}\S/.test(line)) {
      const buf = [];
      while (i < lines.length && (/^ {4}/.test(lines[i]) || !lines[i].trim())) {
        buf.push(lines[i].slice(4));
        i++;
      }
      out.push(codeSnippet(buf.join("\n").replace(/\n+$/, ""), "plain").value);
      continue;
    }

    // paragraph: gather until a blank line or a block starter
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^\s{0,3}(#{1,6}\s|>|```|~~~|([-*+]|\d+[.)])\s)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${mdInlineHTML(buf.join(" ")).value}</p>`);
  }

  return new SafeHTML(out.join(""));
}


/* Theme (light default, dark optional) */

function applyTheme(name) {
  document.documentElement.dataset.theme = name === "dark" ? "dark" : "light";
}

function initTheme() {
  applyTheme(readStored("theme") === "dark" ? "dark" : "light");

  el("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
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
