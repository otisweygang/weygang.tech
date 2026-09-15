window.siteContent = {
  brand: "WEYGANG",

  headerLinks: [
    { label: "[github]", url: "https://github.com/otisweygang" },
  ],

  categories: {
    websites: "websites",
    projects: "projects",
    cv: "cv",
  },
  categoryOrder: ["websites", "projects", "cv"],

  projects: [
    {
      name: "icahd.org",
      category: "websites",
      description: "International Coalition Against Housing Destruction",
      stack: ["Astro", "TS", "HTML", "CSS"],
      url: "https://icahd.org",
      screenshot: "./assets/previews/icahd.webp",
    },
    {
      name: "78years.com",
      category: "websites",
      description: "Documentary feature film",
      stack: ["JS", "HTML", "CSS"],
      url: "https://78years.com",
      repo: "otisweygang/78years",
      screenshot: "./assets/previews/78years.webp",
    },
    {
      name: "calmergames.com",
      category: "websites",
      description: "Low-stimulus games for kids in care",
      stack: ["JS", "HTML", "CSS"],
      url: "https://calmergames.com",
      repo: "otisweygang/calmer-games",
      screenshot: "./assets/previews/calmergames.webp",
    },
    {
      name: "bonezbizarre.com",
      category: "websites",
      description: "Artist portfolio",
      stack: ["JS", "HTML", "CSS"],
      url: "https://bonezbizarre.com",
      repo: "otisweygang/bonez",
      screenshot: "./assets/previews/bonezbizarre.webp",
    },
    {
      name: "mamba-uk.com",
      category: "websites",
      description: "Artist portfolio",
      stack: ["JS", "HTML", "CSS"],
      url: "https://mamba-uk.com",
      repo: "otisweygang/mamba",
      screenshot: "./assets/previews/mamba-uk.webp",
    },
    {
      name: "urlstatuscheck",
      category: "projects",
      description: "Concurrent URL health checker",
      stack: ["Go"],
      url: "https://github.com/otisweygang/siteprobe",
      preview: { kind: "repo", repo: "otisweygang/siteprobe" },
    },
    {
      name: "minilab-demo",
      category: "projects",
      description: "PVD control HMI simulator",
      stack: ["JS", "HTML", "CSS"],
      url: "./demos/minilab/index.html",
      repo: "otisweygang/minilab-demo",
      screenshot: "./assets/previews/minilab-demo.webp",
    },
    {
      name: "CV",
      category: "cv",
      description: "Otis Weygang",
      stack: ["PDF"],
      url: "/assets/Otis_Weygang_CV_redacted.pdf",
      preview: { kind: "pdf" },
    },
  ],

  about: [
    "Otis Weygang — builds small, fast, hand-made websites and the odd CLI tool.",
    "Prefers static output, no build step where one isn't earned, and code you can read.",
    "This page exists because a tester said the real portfolio was boring. Fair.",
  ],

  whoami: [
    "visitor",
    "(but if you're the tester: hi, was this less boring?)",
  ],

  themes: ["green", "amber", "paper"],
  themeStorageKey: "test-theme",

  layouts: ["terminal", "gallery"],
  layoutStorageKey: "test-layout",

  stackColors: {
    JS: "js",
    TS: "ts",
    Astro: "astro",
    HTML: "html",
    CSS: "css",
    Go: "go",
    PDF: "pdf",
  },

  gallery: {
    openLabel: "view",
  },

  preview: {
    openLabel: "open ↗",
    closeLabel: "×",
    downloadLabel: "download",
    loading: "loading…",
    noScreenshot: "no preview available for this one.",
    noRepo: "source not published for this one.",
    repoRoot: "root",
    repoErrors: {
      notFound: "not found",
      rateLimited: "GitHub rate limit hit — try again in a bit",
      private: "private repo — source not shown",
      generic: "could not load ({status})",
    },
  },

  boot: {
    bannerArt: [
  "██╗    ██╗███████╗██╗   ██╗ ██████╗  █████╗ ███╗   ██╗ ██████╗ ",
  "██║    ██║██╔════╝╚██╗ ██╔╝██╔════╝ ██╔══██╗████╗  ██║██╔════╝ ",
  "██║ █╗ ██║█████╗   ╚████╔╝ ██║  ███╗███████║██╔██╗ ██║██║  ███╗",
  "██║███╗██║██╔══╝    ╚██╔╝  ██║   ██║██╔══██║██║╚██╗██║██║   ██║",
  "╚███╔███╔╝███████╗   ██║   ╚██████╔╝██║  ██║██║ ╚████║╚██████╔╝",
  " ╚══╝╚══╝ ╚══════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ",
],
    ready: "click a button below or type `help` and press Enter",
  },

  matrix: {
    intro: "wake up, Neo...",
  },

  crash: {
    countdown: ["triggering kernel panic in 3...", "2...", "1..."],
    recovered: "...and we're back. (nothing actually crashed)",
  },

  konami: {
    reward:
      "Up Up Down Down Left Right Left Right B A  —  30 lives granted. use them on something less boring.",
  },

  messages: {
    commandNotFound: "{name}: command not found",
    tryHelp: "run `help` for the list",
    helpHeading: "available commands:",
    helpFooter: "also: the Konami code  ·  Up / Down for history  ·  Tab to complete",
    openUsage: "usage: open <name>   (try `ls`)",
    openNotFound: "open: {name}: not found. run `ls` to see what's here.",
    catUsage: "usage: cat <name>   (try `ls`)",
    catNotFound: "cat: {name}: no such project",
    cdNotFound: "cd: {name}: no such directory",
  },

  commands: [
    { name: "help", summary: "list every command", chip: true },
    { name: "about", summary: "who is this", chip: true },
    { name: "whoami", summary: "existential", chip: true },
    { name: "ls", summary: "list projects", chip: true },
    { name: "open", summary: "open a project preview", chip: true, chipText: "open bonezbizarre.com" },
    { name: "cat", summary: "print what a project is", chip: true, chipText: "cat urlstatuscheck" },
    { name: "cd", summary: "walk the (pretend) filesystem", chip: true, chipText: "cd projects" },
    { name: "pwd", summary: "print the current path", chip: true },
    { name: "echo", summary: "say it back", chip: true, chipText: "echo hello" },
    { name: "date", summary: "current time, UTC", chip: true },
    { name: "theme", summary: "set or cycle green / amber / paper", chip: true, chipText: "theme amber" },
    { name: "stars", summary: "set starfield density", chip: true, chipText: "stars 500" },
    { name: "matrix", summary: "you already know", chip: true },
    { name: "crash", summary: "trigger a totally real system failure", chip: true },
    { name: "clear", summary: "wipe the screen (or Ctrl-L)", chip: true },
    {
      name: "sudo",
      summary: "you are not root",
      chip: true,
      chipText: "sudo make me a sandwich",
      responses: {
        sandwich: [
          "Okay.",
          "      __",
          "  .-'`  `'-.",
          " (  .------.  )",
          "  '-.______.-'   <- sandwich (root-authorised)",
        ],
        denied: [
          "visitor is not in the sudoers file. This incident will be reported.",
          "...to nobody. There's no server. It's just you and this page.",
        ],
        usage: "usage: sudo <command>",
      },
    },
    {
      name: "make",
      summary: "no rule to make target",
      chip: true,
      chipText: "make me a sandwich",
      responses: {
        sandwich: ["What? Make it yourself.", "(hint: try `sudo`)"],
        noRule: "make: *** No rule to make target '{target}'.  Stop.",
      },
    },
    {
      name: "rm",
      summary: "there is nothing to remove",
      chip: true,
      chipText: "rm -rf /",
      responses: {
        blocked: ["Nice try.", "Nothing here is real enough to delete."],
        harmless: "rm: it's a static page. There's nothing to remove.",
      },
    },
    {
      name: "vim",
      summary: "there is no vim",
      chip: true,
      responses: {
        trapped: "You're trapped forever. (just kidding — there's no vim). :q!",
      },
    },
    {
      name: "man",
      summary: "read the manual",
      chip: true,
      chipText: "man ls",
      responses: {
        noArg: "What manual page do you want?",
        noEntry: "No manual entry for {name}. Try `help`.",
      },
    },
  ],
};
