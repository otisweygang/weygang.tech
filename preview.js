(function () {
  const config = window.siteContent.preview;

  const backdrop = document.getElementById("preview-backdrop");
  const panel = document.getElementById("preview");
  const titleEl = document.getElementById("preview-title");
  const openLink = document.getElementById("preview-open");
  const closeButton = document.getElementById("preview-close");
  const body = document.getElementById("preview-body");

  let onClosed = null;


  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolvePreview(project) {
    if (window.projectDemo && window.projectDemo.has(project.name)) {
      return { kind: "demo" };
    }
    if (project.preview) {
      return project.preview;
    }
    if (project.category === "websites") {
      return { kind: "website" };
    }
    const repoMatch = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(project.url || "");
    if (repoMatch) {
      return { kind: "repo", repo: repoMatch[1] };
    }
    if (/\.pdf($|[?#])/i.test(project.url || "")) {
      return { kind: "pdf" };
    }
    return { kind: "website" };
  }


  function open(project, closedCallback) {
    onClosed = closedCallback || null;
    const preview = resolvePreview(project);

    titleEl.textContent = project.name;
    openLink.textContent = config.openLabel;
    openLink.href = project.url;
    closeButton.textContent = config.closeLabel;
    body.innerHTML = "";

    backdrop.hidden = false;
    panel.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
      panel.classList.add("is-open");
    });

    if (preview.kind === "demo") {
      renderDemo(project);
    } else if (preview.kind === "repo") {
      body.innerHTML = "";
      renderRepo(preview.repo, body);
    } else if (preview.kind === "pdf") {
      renderPdf(project.url);
    } else {
      renderWebsite(project);
    }
  }

  // Split view: a scripted terminal demo up top, the GitHub source browser below,
  // switched with two tabs. The demo repaints its typing animation each time it is
  // shown, so we build both panes once and just toggle a class.
  function renderDemo(project) {
    const repo =
      project.repo ||
      (/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(project.url || "") || [])[1] ||
      null;

    body.innerHTML =
      `<div class="preview-tabs">` +
      `<button class="preview-tab is-active" data-pane="demo">demo</button>` +
      (repo ? `<button class="preview-tab" data-pane="source">source</button>` : "") +
      `</div>` +
      `<div class="preview-pane is-active" id="pane-demo"></div>` +
      (repo ? `<div class="preview-pane" id="pane-source"></div>` : "");

    window.projectDemo.render(project.name, body.querySelector("#pane-demo"));

    let sourceLoaded = false;
    const tabs = body.querySelectorAll(".preview-tab");
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        for (const other of tabs) other.classList.remove("is-active");
        tab.classList.add("is-active");
        for (const pane of body.querySelectorAll(".preview-pane")) {
          pane.classList.toggle("is-active", pane.id === `pane-${tab.dataset.pane}`);
        }
        if (tab.dataset.pane === "source" && repo && !sourceLoaded) {
          sourceLoaded = true;
          renderRepo(repo, body.querySelector("#pane-source"));
        }
      });
    }
  }

  function close() {
    if (panel.hidden) {
      return;
    }
    backdrop.classList.remove("is-open");
    panel.classList.remove("is-open");
    setTimeout(() => {
      backdrop.hidden = true;
      panel.hidden = true;
      body.innerHTML = "";
    }, 260);
    if (onClosed) {
      onClosed();
      onClosed = null;
    }
  }

  function isOpen() {
    return !panel.hidden;
  }


  function renderWebsite(project) {
    const url = escapeHtml(project.url);
    const hasSource = !!project.repo;
    const hasScreenshot = !!project.screenshot;

    body.innerHTML =
      `<div class="preview-tabs">` +
      `<button class="preview-tab is-active" data-pane="site">preview</button>` +
      `<button class="preview-tab" data-pane="source">source</button>` +
      `</div>` +
      `<div class="preview-pane is-active" id="pane-site">` +
      `<div class="preview-screen"></div>` +
      `</div>` +
      `<div class="preview-pane" id="pane-source"></div>`;

    const screen = body.querySelector(".preview-screen");

    if (hasScreenshot) {
      screen.innerHTML =
        `<a class="preview-shot-link" href="${url}" target="_blank" rel="noopener">` +
        `<img class="preview-shot" src="${escapeHtml(project.screenshot)}" alt="Screenshot of ${escapeHtml(project.name)}" loading="lazy" />` +
        `<span class="preview-shot-hint">${escapeHtml(config.openLabel)}</span>` +
        `</a>`;
    } else {
      screen.innerHTML =
        `<div class="preview-message">` +
        `<p>${escapeHtml(config.noScreenshot)}</p>` +
        `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(config.openLabel)}</a>` +
        `</div>`;
    }

    let sourceLoaded = false;
    const loadSource = () => {
      if (sourceLoaded) return;
      sourceLoaded = true;
      const pane = body.querySelector("#pane-source");
      if (hasSource) {
        renderRepo(project.repo, pane);
      } else {
        pane.innerHTML = `<div class="preview-message"><p>${escapeHtml(config.noRepo)}</p></div>`;
      }
    };

    const tabs = body.querySelectorAll(".preview-tab");
    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        for (const other of tabs) other.classList.remove("is-active");
        tab.classList.add("is-active");
        for (const pane of body.querySelectorAll(".preview-pane")) {
          pane.classList.toggle("is-active", pane.id === `pane-${tab.dataset.pane}`);
        }
        if (tab.dataset.pane === "source") loadSource();
      });
    }
  }

  function renderPdf(url) {
    const wrap = document.createElement("div");
    wrap.className = "preview-pdf";
    wrap.innerHTML =
      `<iframe class="preview-frame" src="${escapeHtml(url)}#toolbar=0" title="PDF preview"></iframe>` +
      `<a class="preview-download" href="${escapeHtml(url)}" download>${escapeHtml(config.downloadLabel)}</a>`;
    body.appendChild(wrap);
  }

  function showMessage(text, url) {
    body.innerHTML =
      `<div class="preview-message">` +
      `<p>${escapeHtml(text)}</p>` +
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(config.openLabel)}</a>` +
      `</div>`;
  }


  const repoCache = new Map();

  function fetchRepoPath(repo, path) {
    const key = `${repo}/${path}`;
    if (!repoCache.has(key)) {
      const request = requestRepoPath(repo, path).catch((error) => {
        repoCache.delete(key);
        throw error;
      });
      repoCache.set(key, request);
    }
    return repoCache.get(key);
  }

  async function requestRepoPath(repo, path) {
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    const response = await fetch(url, { headers: { Accept: "application/vnd.github.raw" } });
    if (!response.ok) {
      throw new Error(describeStatus(response.status));
    }
    const text = await response.text();
    const listing = parseListing(text);
    if (!listing) {
      return { type: "file", text };
    }
    listing.sort(directoriesFirst);
    return { type: "dir", entries: listing };
  }

  function parseListing(text) {
    try {
      const parsed = JSON.parse(text);
      const looksRight = Array.isArray(parsed) && parsed.every((entry) => entry && "type" in entry && "path" in entry);
      return looksRight ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function describeStatus(status) {
    if (status === 404) return config.repoErrors.notFound;
    if (status === 403) return config.repoErrors.rateLimited;
    if (status === 401) return config.repoErrors.private;
    return config.repoErrors.generic.replace("{status}", status);
  }

  function directoriesFirst(a, b) {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  }


  function renderRepo(repo, target) {
    target.innerHTML =
      `<div class="repo">` +
      `<div class="repo-crumbs" id="repo-crumbs"></div>` +
      `<div class="repo-body" id="repo-body"></div>` +
      `</div>`;
    openRepoDir(repo, "");
  }

  function renderCrumbs(repo, path, fileName) {
    const crumbs = document.getElementById("repo-crumbs");
    const segments = path ? path.split("/") : [];
    let accumulated = "";
    const parts = [`<button class="repo-crumb" data-path="">${escapeHtml(config.repoRoot)}</button>`];
    for (const segment of segments) {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      parts.push(`<span class="repo-sep">/</span>`);
      parts.push(`<button class="repo-crumb" data-path="${escapeHtml(accumulated)}">${escapeHtml(segment)}</button>`);
    }
    if (fileName) {
      parts.push(`<span class="repo-sep">/</span>`);
      parts.push(`<span class="repo-crumb repo-crumb-file">${escapeHtml(fileName)}</span>`);
    }
    crumbs.innerHTML = parts.join("");
    for (const crumb of crumbs.querySelectorAll("button.repo-crumb")) {
      crumb.addEventListener("click", () => openRepoDir(repo, crumb.dataset.path));
    }
  }

  function openRepoDir(repo, path) {
    renderCrumbs(repo, path);
    const target = document.getElementById("repo-body");
    target.textContent = config.loading;
    fetchRepoPath(repo, path)
      .then((result) => {
        if (result.type === "file") {
          openRepoFile(repo, path);
          return;
        }
        target.innerHTML =
          `<div class="repo-list">` +
          result.entries
            .map((entry) => {
              const isDir = entry.type === "dir";
              return (
                `<button class="repo-row" data-type="${entry.type}" data-path="${escapeHtml(entry.path)}">` +
                `<span class="repo-glyph">${isDir ? "▸" : " "}</span>` +
                `<span class="repo-name">${escapeHtml(entry.name)}${isDir ? "/" : ""}</span>` +
                `</button>`
              );
            })
            .join("") +
          `</div>`;
        for (const row of target.querySelectorAll(".repo-row")) {
          row.addEventListener("click", () => {
            if (row.dataset.type === "dir") {
              openRepoDir(repo, row.dataset.path);
            } else {
              openRepoFile(repo, row.dataset.path);
            }
          });
        }
      })
      .catch((error) => {
        target.innerHTML = `<div class="preview-message"><p>${escapeHtml(error.message)}</p></div>`;
      });
  }

  function openRepoFile(repo, path) {
    const slash = path.lastIndexOf("/");
    const parent = slash === -1 ? "" : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    renderCrumbs(repo, parent, name);

    const target = document.getElementById("repo-body");
    target.textContent = config.loading;
    fetchRepoPath(repo, path)
      .then((result) => {
        const text = result.type === "file" ? result.text : "";
        target.innerHTML = codeBlock(text, languageFor(name));
      })
      .catch((error) => {
        target.innerHTML = `<div class="preview-message"><p>${escapeHtml(error.message)}</p></div>`;
      });
  }


  const extensionLanguages = {
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
    const extension = dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
    if (extensionLanguages[extension]) {
      return extensionLanguages[extension];
    }
    if (/^(Dockerfile|Makefile)$/i.test(filename)) {
      return "shell";
    }
    return "plain";
  }

  const clikeKeywords = new Set(
    ("const let var function return if else for while do switch case break continue " +
      "new class extends super this typeof instanceof in of void delete yield await async " +
      "try catch finally throw import export from as default static get set " +
      "func package type struct interface map chan go defer select range fallthrough " +
      "int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 " +
      "string bool byte rune error nil true false null undefined " +
      "public private protected void short long double char unsigned signed sizeof " +
      "union enum extern register volatile goto").split(" "),
  );

  function paint(line, expression, classify) {
    let out = "";
    let last = 0;
    for (const match of line.matchAll(expression)) {
      out += escapeHtml(line.slice(last, match.index));
      const className = classify(match);
      out += className
        ? `<span class="tok-${className}">${escapeHtml(match[0])}</span>`
        : escapeHtml(match[0]);
      last = match.index + match[0].length;
    }
    return out + escapeHtml(line.slice(last));
  }

  const highlighters = {
    plain: (line) => escapeHtml(line),

    clike: (line) => {
      const expression =
        /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;
      return paint(line, expression, (match) => {
        if (match[1]) return "comment";
        if (match[2]) return "string";
        if (match[3]) return "number";
        if (match[4]) return clikeKeywords.has(match[4]) ? "keyword" : "function";
        if (match[5]) return clikeKeywords.has(match[5]) ? "keyword" : null;
        return null;
      });
    },

    css: (line) => {
      const expression =
        /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr|ch)?\b)|(@[\w-]+|--[\w-]+)|([.#]?-?[A-Za-z_][\w-]*)(?=\s*[:{(])/g;
      return paint(line, expression, (match) => {
        if (match[1]) return "comment";
        if (match[2]) return "string";
        if (match[3]) return "number";
        if (match[4]) return "keyword";
        if (match[5]) return "function";
        return null;
      });
    },

    markup: (line) => {
      const expression = /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w-]*)|([A-Za-z-]+)(?==)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\/?>)/g;
      return paint(line, expression, (match) => {
        if (match[1]) return "comment";
        if (match[2]) return "tag";
        if (match[3]) return "attr";
        if (match[4]) return "string";
        if (match[5]) return "tag";
        return null;
      });
    },

    json: (line) => {
      const expression = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d[\d.eE+-]*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
      return paint(line, expression, (match) => {
        if (match[1]) return match[2] ? "attr" : "string";
        if (match[3]) return "number";
        if (match[4]) return "keyword";
        return null;
      });
    },

    yaml: (line) => {
      const expression = /(#[^\n]*)|(^\s*[A-Za-z_][\w-]*)(?=:)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b-?\d[\d.]*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;
      return paint(line, expression, (match) => {
        if (match[1]) return "comment";
        if (match[2]) return "attr";
        if (match[3]) return "string";
        if (match[4]) return "number";
        if (match[5]) return "keyword";
        return null;
      });
    },

    shell: (line) => {
      const expression = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'[^']*')|(\$\w+|\$\{[^}]*\})|(^\s*[A-Za-z_][\w-]*)(?==)/g;
      return paint(line, expression, (match) => {
        if (match[1]) return "comment";
        if (match[2]) return "string";
        if (match[3]) return "keyword";
        if (match[4]) return "attr";
        return null;
      });
    },

    markdown: (line) => {
      if (/^\s{0,3}#{1,6}\s/.test(line)) {
        return `<span class="tok-keyword">${escapeHtml(line)}</span>`;
      }
      if (/^\s*>/.test(line)) {
        return `<span class="tok-comment">${escapeHtml(line)}</span>`;
      }
      return paint(
        line,
        /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\[[^\]]+\]\([^)]+\))/g,
        (match) => (match[1] ? "string" : match[2] ? "function" : match[3] ? "tag" : null),
      );
    },
  };

  function highlightLines(text, language) {
    const highlight = highlighters[language] || highlighters.plain;
    return text
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => `<span class="code-line">${highlight(line) || " "}</span>`)
      .join("");
  }

  function codeBlock(text, language) {
    const lines = text.replace(/\n$/, "").split("\n");
    const gutter = lines.map((unused, index) => `<span>${index + 1}</span>`).join("");
    return (
      `<div class="code">` +
      `<div class="code-gutter">${gutter}</div>` +
      `<pre class="code-text">${highlightLines(text, language)}</pre>` +
      `</div>`
    );
  }


  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      close();
    }
  });

  window.preview = { open, close, isOpen };
})();
