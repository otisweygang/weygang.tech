const content = window.siteContent;

const projects = content.projects;
const themes = content.themes;

const terminalEl = document.getElementById("terminal");
const root = document.documentElement;

const commandHistory = [];
let historyIndex = 0;
let currentPath = "~";
let acceptingInput = false;
let promptRow = null;
let promptInput = null;
let promptCursor = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
}

function findProject(name) {
  return projects.find((project) => project.name === name);
}

function projectCategories() {
  const order = content.categoryOrder || [];
  const names = order.slice();
  for (const project of projects) {
    if (project.category && !names.includes(project.category)) {
      names.push(project.category);
    }
  }
  return names.map((name) => ({
    name,
    count: projects.filter((project) => project.category === name).length,
  }));
}

function findCommand(name) {
  return commands.find((command) => command.name === name);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function utcTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
  return `${date} ${time} UTC`;
}


const terminal = {
  projects,

  print(text = "", style = "") {
    const row = document.createElement("div");
    row.className = style ? `row ${style}` : "row";
    row.textContent = text;
    terminalEl.insertBefore(row, promptRow);
    this.scrollToBottom();
    return row;
  },

  printLines(lines, style = "") {
    lines.forEach((line) => this.print(line, style));
  },

  printHtml(html, style = "") {
    const row = document.createElement("div");
    row.className = style ? `row ${style}` : "row";
    row.innerHTML = html;
    terminalEl.insertBefore(row, promptRow);
    this.scrollToBottom();
    return row;
  },

  printLink(label, url) {
    this.printHtml(`→ <a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`);
  },

  clear() {
    terminalEl.querySelectorAll(".row").forEach((row) => row.remove());
  },

  scrollToBottom() {
    terminalEl.scrollTop = terminalEl.scrollHeight;
  },

  async typeLine(text, style = "") {
    const row = this.print("", style);
    for (const character of text) {
      row.textContent += character;
      await wait(14);
    }
    this.scrollToBottom();
    return row;
  },

};


const commandHandlers = {
  help(term) {
    term.print(content.messages.helpHeading, "accent");
    for (const command of commands) {
      term.print("  " + command.name.padEnd(14, " ") + command.summary, "dim");
    }
    term.print("");
    term.print(content.messages.helpFooter, "faint");
  },

  about(term) {
    term.printLines(content.about, "dim");
  },

  whoami(term) {
    term.print(content.whoami[0], "accent");
    term.printLines(content.whoami.slice(1), "faint");
  },

  ls(term) {
    const nameWidth = Math.max(...projects.map((project) => project.name.length)) + 2;
    const categories = projectCategories();
    for (const category of categories) {
      const members = projects.filter((project) => project.category === category.name);
      if (members.length === 0) {
        continue;
      }
      const label = (content.categories && content.categories[category.name]) || category.name;
      term.print("  " + label.toUpperCase(), "accent");
      for (const project of members) {
        term.printHtml(
          `<span class="ls-row">` +
            `<button class="inline-link" data-open="${project.name}">${escapeHtml(project.name)}</button>` +
            `<span class="ls-pad">${" ".repeat(nameWidth - project.name.length)}</span>` +
            `<span class="faint ls-desc">${escapeHtml(project.description)}</span>` +
            `</span>`,
          "ls-entry",
        );
      }
      term.print("");
    }
  },

  open(term, args) {
    const name = args[0];
    if (!name) {
      term.print(content.messages.openUsage, "amber");
      return;
    }
    const project = findProject(name);
    if (!project) {
      term.print(fill(content.messages.openNotFound, { name }), "rose");
      return;
    }
    term.print(`opening ${name}`, "accent");
    openProjectPreview(project);
  },

  cat(term, args) {
    const name = args[0];
    if (!name) {
      term.print(content.messages.catUsage, "amber");
      return;
    }
    const project = findProject(name);
    if (!project) {
      term.print(fill(content.messages.catNotFound, { name }), "rose");
      return;
    }
    term.print(project.description, "dim");
    term.printLink(project.url, project.url);
  },

  cd(term, args) {
    const target = (args[0] || "~").replace(/\/+$/, "");
    if (target === "~" || target === "" || target === "/" || target === "..") {
      currentPath = "~";
    } else if (target === "projects") {
      currentPath = "~/projects";
    } else if (findProject(target)) {
      currentPath = `~/projects/${target}`;
    } else {
      term.print(fill(content.messages.cdNotFound, { name: target }), "rose");
    }
    updatePromptLabel();
  },

  pwd(term) {
    term.print(currentPath.replace("~", "/home/visitor"));
  },

  echo(term, args) {
    term.print(args.join(" "));
  },

  date(term) {
    term.print(new Date().toUTCString());
  },

  theme(term) {
    cycleTheme();
    term.print(`phosphor: ${root.dataset.theme || "green"}`, "accent");
  },

  stars(term, args) {
    const count = Math.max(0, Math.min(1200, parseInt(args[0], 10) || 220));
    setStarCount(count);
    term.print(`starfield density set to ${count}`, "accent");
  },

  async matrix(term) {
    term.print(content.matrix.intro, "accent");
    await wait(400);
    startMatrix();
  },

  async crash(term) {
    for (const line of content.crash.countdown) {
      term.print(line, "rose");
      await wait(500);
    }
    showCrash();
  },

  clear(term) {
    term.clear();
  },

  sudo(term, args, command) {
    const rest = args.join(" ");
    if (/make me a sandwich/i.test(rest)) {
      term.printLines(command.responses.sandwich, "art");
      return;
    }
    if (rest) {
      term.print(command.responses.denied[0], "rose");
      term.printLines(command.responses.denied.slice(1), "faint");
      return;
    }
    term.print(command.responses.usage, "amber");
  },

  make(term, args, command) {
    if (args.join(" ").toLowerCase() === "me a sandwich") {
      term.print(command.responses.sandwich[0], "amber");
      term.printLines(command.responses.sandwich.slice(1), "faint");
      return;
    }
    term.print(fill(command.responses.noRule, { target: args.join(" ") }), "rose");
  },

  rm(term, args, command) {
    if (/^-rf?$/.test(args[0] || "") && /^[/~*]/.test(args[1] || "")) {
      term.print(command.responses.blocked[0], "amber");
      term.printLines(command.responses.blocked.slice(1), "faint");
      return;
    }
    term.print(command.responses.harmless, "faint");
  },

  vim(term, args, command) {
    term.print(command.responses.trapped, "faint");
  },

  man(term, args, command) {
    if (!args[0]) {
      term.print(command.responses.noArg, "amber");
      return;
    }
    term.print(fill(command.responses.noEntry, { name: args[0] }), "dim");
  },
};

const commands = content.commands.map((entry) => ({
  ...entry,
  run: commandHandlers[entry.name],
}));


function buildHeader() {
  const brandEl = document.querySelector(".brand");
  brandEl.firstChild.textContent = content.brand;
  const actions = document.querySelector(".header-actions");
  for (const link of content.headerLinks) {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = link.label;
    actions.appendChild(anchor);
  }
}


function buildPrompt() {
  promptRow = document.createElement("div");
  promptRow.className = "prompt";
  promptRow.innerHTML =
    `<span class="prompt-label">visitor<span class="path"> ${currentPath} </span>$</span>` +
    `<span class="prompt-input" contenteditable="true" spellcheck="false" autocapitalize="off" autocorrect="off"></span>` +
    `<span class="prompt-cursor"></span>`;
  terminalEl.appendChild(promptRow);
  promptInput = promptRow.querySelector(".prompt-input");
  promptCursor = promptRow.querySelector(".prompt-cursor");
  promptInput.addEventListener("keydown", onPromptKeyDown);
  promptInput.addEventListener("input", syncCursor);
  promptInput.addEventListener("keyup", syncCursor);
  promptInput.addEventListener("click", syncCursor);
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === promptInput) {
      syncCursor();
    }
  });
}

function caretOffset() {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    return promptInput.textContent.length;
  }
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(promptInput);
  range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
  return range.toString().length;
}

function syncCursor() {
  const text = promptInput.textContent;
  const offset = Math.min(caretOffset(), text.length);
  promptCursor.textContent = text[offset] || " ";
  const rowBox = promptRow.getBoundingClientRect();
  const inputBox = promptInput.getBoundingClientRect();
  promptCursor.style.top = inputBox.top - rowBox.top + "px";
  promptCursor.style.left = inputBox.left - rowBox.left + measureTextWidth(text.slice(0, offset)) + "px";
}

function measureTextWidth(text) {
  const probe = promptRow.__probe || (promptRow.__probe = makeProbe());
  probe.textContent = text;
  return probe.getBoundingClientRect().width;
}

function makeProbe() {
  const span = document.createElement("span");
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.whiteSpace = "pre";
  span.style.font = getComputedStyle(promptInput).font;
  promptRow.appendChild(span);
  return span;
}

function updatePromptLabel() {
  const path = promptRow.querySelector(".path");
  if (path) {
    path.textContent = ` ${currentPath} `;
  }
}

function moveCaretToEnd() {
  const range = document.createRange();
  range.selectNodeContents(promptInput);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  syncCursor();
}

function focusPrompt() {
  promptInput.focus();
  moveCaretToEnd();
}

function echoCommandLine(text) {
  terminal.printHtml(
    `<span class="prompt-label">visitor<span class="path"> ${currentPath} </span>$</span> ${escapeHtml(text)}`,
  );
}

async function submitCommand(text) {
  echoCommandLine(text);
  if (text) {
    commandHistory.push(text);
    historyIndex = commandHistory.length;
  }
  await runCommand(text);
  terminal.scrollToBottom();
}

async function autoRunCommand(text) {
  promptInput.textContent = "";
  for (const character of text) {
    promptInput.textContent += character;
    moveCaretToEnd();
    terminal.scrollToBottom();
    await wait(90);
  }
  await wait(250);
  promptInput.textContent = "";
  await submitCommand(text);
}

async function runCommand(text) {
  if (!text) {
    return;
  }
  const parts = text.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);
  const command = findCommand(name);
  if (!command || !command.run) {
    terminal.print(fill(content.messages.commandNotFound, { name }), "rose");
    terminal.print(content.messages.tryHelp, "faint");
    return;
  }
  try {
    await command.run(terminal, args, command, text);
  } catch (error) {
    terminal.print(`internal error: ${error.message || error}`, "rose");
  }
}

function completeInput(text) {
  const parts = text.trim().split(/\s+/);
  if (parts.length <= 1) {
    const matches = commands.filter((command) => command.name.startsWith(parts[0]));
    return matches.length === 1 ? matches[0].name + " " : null;
  }
  if (parts[0] === "open" || parts[0] === "cat") {
    const matches = projects.filter((project) => project.name.startsWith(parts[1] || ""));
    return matches.length === 1 ? `${parts[0]} ${matches[0].name}` : null;
  }
  return null;
}

function onPromptKeyDown(event) {
  if (!acceptingInput) {
    event.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const text = promptInput.textContent.trim();
    promptInput.textContent = "";
    syncCursor();
    submitCommand(text);
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (historyIndex > 0) {
      historyIndex -= 1;
      promptInput.textContent = commandHistory[historyIndex] || "";
      moveCaretToEnd();
    }
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (historyIndex < commandHistory.length - 1) {
      historyIndex += 1;
      promptInput.textContent = commandHistory[historyIndex] || "";
    } else {
      historyIndex = commandHistory.length;
      promptInput.textContent = "";
    }
    moveCaretToEnd();
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    const completion = completeInput(promptInput.textContent);
    if (completion) {
      promptInput.textContent = completion;
      moveCaretToEnd();
    }
    return;
  }

  if (event.key === "l" && event.ctrlKey) {
    event.preventDefault();
    terminal.clear();
  }
}


function runFromButton(text) {
  if (!acceptingInput) {
    return;
  }
  promptInput.textContent = "";
  submitCommand(text);
  focusPrompt();
}


const helpBackdrop = document.getElementById("help-backdrop");
const helpPanel = document.getElementById("help-panel");
const helpBody = document.getElementById("help-body");

function buildHelpPanel() {
  document.getElementById("help-title").textContent = content.messages.helpHeading;
  document.getElementById("help-close").addEventListener("click", closeHelp);
  helpBackdrop.addEventListener("click", closeHelp);
  document.getElementById("help-button").addEventListener("click", () => {
    if (isHelpOpen()) {
      closeHelp();
    } else {
      openHelp();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isHelpOpen()) {
      closeHelp();
    }
  });

  const list = document.createElement("div");
  list.className = "help-list";
  for (const command of [...commands].sort((a, b) => a.name.localeCompare(b.name))) {
    const text = command.chipText || command.name;
    const row = document.createElement("button");
    row.className = "help-row";
    row.type = "button";
    row.innerHTML =
      `<span class="help-cmd">${escapeHtml(text)}</span>` +
      `<span class="help-summary">${escapeHtml(command.summary)}</span>`;
    row.addEventListener("click", () => {
      closeHelp();
      runFromButton(text);
    });
    list.appendChild(row);
  }
  helpBody.appendChild(list);

  const footer = document.createElement("p");
  footer.className = "help-foot";
  footer.textContent = content.messages.helpFooter;
  helpBody.appendChild(footer);
}

function openHelp() {
  helpBackdrop.hidden = false;
  helpPanel.hidden = false;
  requestAnimationFrame(() => {
    helpBackdrop.classList.add("is-open");
    helpPanel.classList.add("is-open");
  });
}

function closeHelp() {
  helpBackdrop.classList.remove("is-open");
  helpPanel.classList.remove("is-open");
  setTimeout(() => {
    helpBackdrop.hidden = true;
    helpPanel.hidden = true;
  }, 260);
  if (acceptingInput) {
    focusPrompt();
  }
}

function isHelpOpen() {
  return !helpPanel.hidden;
}


async function runBootSequence() {
  const boot = content.boot;
  acceptingInput = false;
  terminal.clear();
  promptRow.classList.add("prompt-idle");

  await terminal.typeLine(utcTimestamp(), "faint");
  terminal.print("");
  for (const line of boot.bannerArt) {
    terminal.print(line, "art accent");
    await wait(70);
  }
  terminal.print("");
  await wait(200);
  terminal.print(boot.ready, "dim");
  terminal.print("");

  promptRow.classList.remove("prompt-idle");
  acceptingInput = true;
  focusPrompt();

  await wait(500);
  await autoRunCommand("ls");
}


const starfieldCanvas = document.getElementById("starfield");
const starfieldContext = starfieldCanvas.getContext("2d");
let stars = [];
let starCount = 220;
let pixelRatio = Math.min(2, window.devicePixelRatio || 1);

function resizeStarfield() {
  pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  starfieldCanvas.width = window.innerWidth * pixelRatio;
  starfieldCanvas.height = window.innerHeight * pixelRatio;
  starfieldCanvas.style.width = `${window.innerWidth}px`;
  starfieldCanvas.style.height = `${window.innerHeight}px`;
}

function seedStars() {
  stars = [];
  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: Math.random() * starfieldCanvas.width,
      y: Math.random() * starfieldCanvas.height,
      depth: Math.random() * 0.8 + 0.2,
    });
  }
}

function setStarCount(count) {
  starCount = count;
  seedStars();
}

function drawStarfield() {
  const color = getComputedStyle(root).getPropertyValue("--accent").trim() || "#35ff87";
  starfieldContext.clearRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
  for (const star of stars) {
    star.y += star.depth * 0.35 * pixelRatio;
    if (star.y > starfieldCanvas.height) {
      star.y = 0;
      star.x = Math.random() * starfieldCanvas.width;
    }
    const size = star.depth * 1.6 * pixelRatio;
    starfieldContext.globalAlpha = star.depth * 0.9;
    starfieldContext.fillStyle = color;
    starfieldContext.fillRect(star.x, star.y, size, size);
  }
  starfieldContext.globalAlpha = 1;
  requestAnimationFrame(drawStarfield);
}


const matrixEl = document.getElementById("matrix");
let matrixCanvas = null;
let matrixAnimation = 0;

function startMatrix() {
  matrixEl.hidden = false;
  if (!matrixCanvas) {
    matrixCanvas = document.createElement("canvas");
    matrixEl.insertBefore(matrixCanvas, matrixEl.firstChild);
  }
  const context = matrixCanvas.getContext("2d");
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;

  const fontSize = 16;
  const columnCount = Math.floor(matrixCanvas.width / fontSize);
  const drops = new Array(columnCount).fill(1);
  const glyphs = "アイウエオカキクケコサシスセソ0123456789ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜ".split("");
  const color = getComputedStyle(root).getPropertyValue("--accent").trim() || "#35ff87";

  function draw() {
    context.fillStyle = "rgba(0, 0, 0, 0.08)";
    context.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    context.fillStyle = color;
    context.font = `${fontSize}px monospace`;
    for (let i = 0; i < drops.length; i += 1) {
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      context.fillText(glyph, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i] += 1;
    }
    matrixAnimation = requestAnimationFrame(draw);
  }

  function stop() {
    cancelAnimationFrame(matrixAnimation);
    matrixEl.hidden = true;
    window.removeEventListener("keydown", onKeyDown);
    matrixEl.removeEventListener("click", stop);
    focusPrompt();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      stop();
    }
  }

  draw();
  window.addEventListener("keydown", onKeyDown);
  matrixEl.addEventListener("click", stop);
}


const crashEl = document.getElementById("crash");
const crashProgressEl = document.getElementById("crash-progress");
let crashInterval = 0;

function showCrash() {
  crashEl.hidden = false;
  let percent = 0;
  clearInterval(crashInterval);
  crashInterval = setInterval(() => {
    percent += Math.floor(Math.random() * 12) + 1;
    if (percent >= 100) {
      percent = 100;
      clearInterval(crashInterval);
    }
    crashProgressEl.textContent = `${percent}% complete`;
  }, 320);

  function recover() {
    clearInterval(crashInterval);
    crashEl.hidden = true;
    crashEl.removeEventListener("click", recover);
    terminal.print(content.crash.recovered, "accent");
    focusPrompt();
  }

  setTimeout(() => crashEl.addEventListener("click", recover), 700);
}


function cycleTheme() {
  const current = root.dataset.theme || "green";
  const next = themes[(themes.indexOf(current) + 1) % themes.length];
  if (next === "green") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = next;
  }
  try {
    localStorage.setItem(content.themeStorageKey, next);
  } catch (error) {
    // localStorage unavailable, theme just won't persist
  }
}

function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(content.themeStorageKey);
    if (saved && saved !== "green") {
      root.dataset.theme = saved;
    }
  } catch (error) {
    // localStorage unavailable, use the default theme
  }
}


const konamiSequence = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];
let konamiIndex = 0;

function onKonamiKey(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === konamiSequence[konamiIndex]) {
    konamiIndex += 1;
  } else {
    konamiIndex = key === konamiSequence[0] ? 1 : 0;
  }
  if (konamiIndex === konamiSequence.length) {
    konamiIndex = 0;
    runKonamiReward();
  }
}

function runKonamiReward() {
  terminal.print(content.konami.reward, "accent");
  setStarCount(Math.min(1000, starCount + 300));
  const original = getComputedStyle(root).getPropertyValue("--accent").trim();
  root.style.setProperty("--accent", "#ff5c8a");
  setTimeout(() => root.style.setProperty("--accent", original), 900);
}


function openProjectPreview(project) {
  document.body.classList.add("preview-active");
  window.preview.open(project, () => {
    document.body.classList.remove("preview-active");
    focusPrompt();
  });
}

function onTerminalClick(event) {
  const openButton = event.target.closest("[data-open]");
  if (openButton) {
    const project = findProject(openButton.dataset.open);
    if (project) {
      openProjectPreview(project);
    }
    return;
  }
  if (window.getSelection().toString()) {
    return;
  }
  focusPrompt();
}


function start() {
  loadSavedTheme();
  buildHeader();

  resizeStarfield();
  seedStars();
  drawStarfield();

  buildPrompt();
  buildHelpPanel();

  terminalEl.addEventListener("click", onTerminalClick);
  document.getElementById("theme-button").addEventListener("click", cycleTheme);
  window.addEventListener("keydown", onKonamiKey);
  window.addEventListener("resize", () => {
    resizeStarfield();
    seedStars();
  });

  runBootSequence();
}

start();
