// Renders a scripted terminal demo for a project.
// Demos live in demos/<name>.js and register on window.projectDemos[name].
// Public API: window.projectDemo.has(name) -> bool
//             window.projectDemo.render(name, targetEl)

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TYPE_MS = 18;   // per character of the command
  const LINE_MS = 90;   // between output lines

  function has(name) {
    return Boolean(window.projectDemos && window.projectDemos[name]);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const toneClass = {
    ok: "demo-ok",
    bad: "demo-bad",
    warn: "demo-warn",
    dim: "demo-dim",
  };

  function render(name, target) {
    const demo = window.projectDemos[name];
    let runToken = 0; // bumped on every new run to cancel a stale one

    target.innerHTML =
      `<div class="demo">` +
      `<div class="demo-scenarios" id="demo-scenarios"></div>` +
      `<div class="demo-screen" id="demo-screen"></div>` +
      `</div>`;

    const bar = target.querySelector("#demo-scenarios");
    const screen = target.querySelector("#demo-screen");

    demo.scenarios.forEach((scenario, index) => {
      const button = document.createElement("button");
      button.className = "demo-scenario";
      button.textContent = scenario.label;
      button.addEventListener("click", () => {
        for (const other of bar.children) other.classList.remove("is-active");
        button.classList.add("is-active");
        play(scenario);
      });
      if (index === 0) button.classList.add("is-active");
      bar.appendChild(button);
    });

    const replay = document.createElement("button");
    replay.className = "demo-replay";
    replay.type = "button";
    replay.textContent = "↻ replay";
    replay.addEventListener("click", () => {
      const active = bar.querySelector(".demo-scenario.is-active");
      const scenario = demo.scenarios[[...bar.children].indexOf(active)] || demo.scenarios[0];
      play(scenario);
    });
    bar.appendChild(replay);

    function line(html, cls) {
      const el = document.createElement("div");
      el.className = "demo-line" + (cls ? " " + cls : "");
      el.innerHTML = html;
      screen.appendChild(el);
      screen.scrollTop = screen.scrollHeight;
      return el;
    }

    function prompt() {
      return `<span class="demo-prompt">${escapeHtml(demo.shell)} $</span> `;
    }

    async function play(scenario) {
      const token = ++runToken;
      screen.innerHTML = "";
      if (demo.blurb) line(escapeHtml(demo.blurb), "demo-dim");

      const cmdEl = line(prompt());
      const cmdText = document.createElement("span");
      cmdEl.appendChild(cmdText);

      if (reduceMotion) {
        cmdText.textContent = scenario.command;
      } else {
        for (let i = 0; i < scenario.command.length; i++) {
          if (token !== runToken) return;
          cmdText.textContent += scenario.command[i];
          screen.scrollTop = screen.scrollHeight;
          await wait(TYPE_MS);
        }
      }

      for (const item of scenario.lines) {
        if (token !== runToken) return;
        if (!reduceMotion) await wait(LINE_MS);
        if (token !== runToken) return;
        if (item.gap) {
          line("&nbsp;");
        } else {
          line(escapeHtml(item.text), toneClass[item.tone] || "");
        }
      }
    }

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    play(demo.scenarios[0]);
  }

  window.projectDemo = { has, render };
})();
