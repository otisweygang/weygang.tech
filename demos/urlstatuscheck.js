// Scripted demo for the "urlstatuscheck" project.
// Registers on window.projectDemos, keyed by the project name in content.js.
//
// Shape:
//   shell      string   prompt label shown before each command
//   blurb      string    one line under the title, plain text
//   scenarios  array     one clickable run each:
//     label    string    button text
//     command  string    typed out char-by-char after the prompt
//     lines    array     streamed after the command, each:
//       text   string    the line (omit for a blank spacer with { gap: true })
//       tone   string    "ok" | "bad" | "warn" | "dim" | undefined  -> colour
//       gap    bool      render an empty line, ignore everything else

(function () {
  window.projectDemos = window.projectDemos || {};

  window.projectDemos["urlstatuscheck"] = {
    shell: "urlstatuscheck",
    blurb: "Reads URLs, hits them concurrently, prints status code + latency for each.",

    scenarios: [
      {
        label: "check 4 sites",
        command:
          "urlstatuscheck https://example.com https://github.com https://httpstat.us/500 https://nope.invalid",
        lines: [
          { text: "dispatching 4 checks (workers: 4)", tone: "dim" },
          { gap: true },
          { text: "  OK    200   142ms   https://example.com", tone: "ok" },
          { text: "  OK    200    88ms   https://github.com", tone: "ok" },
          { text: "  DOWN  500   210ms   https://httpstat.us/500", tone: "bad" },
          { text: "  ERR     -     0ms   https://nope.invalid  (dial: no such host)", tone: "warn" },
          { gap: true },
          { text: "4 checked · 2 up · 1 down · 1 error · 210ms wall", tone: "dim" },
          { text: "exit 1", tone: "dim" },
        ],
      },
      {
        label: "read from a file",
        command: "urlstatuscheck -f sites.txt -timeout 3s",
        lines: [
          { text: "loaded 6 URLs from sites.txt", tone: "dim" },
          { text: "dispatching 6 checks (workers: 6)", tone: "dim" },
          { gap: true },
          { text: "  OK    200    41ms   https://weygang.tech", tone: "ok" },
          { text: "  OK    200   119ms   https://icahd.org", tone: "ok" },
          { text: "  OK    204    77ms   https://bonezbizarre.com", tone: "ok" },
          { text: "  OK    200   162ms   https://mamba-uk.com", tone: "ok" },
          { text: "  OK    301    58ms   https://thegentlehand.netlify.app  -> /", tone: "ok" },
          { text: "  DOWN  522  3000ms   https://slow.example  (timeout)", tone: "bad" },
          { gap: true },
          { text: "6 checked · 5 up · 1 down · 3.00s wall", tone: "dim" },
          { text: "exit 1", tone: "dim" },
        ],
      },
      {
        label: "json + all healthy",
        command: "urlstatuscheck -json https://example.com https://github.com",
        lines: [
          { text: '{"url":"https://example.com","ok":true,"code":200,"ms":140}', tone: "dim" },
          { text: '{"url":"https://github.com","ok":true,"code":200,"ms":91}', tone: "dim" },
          { text: '{"checked":2,"up":2,"down":0,"wall_ms":140}', tone: "dim" },
          { text: "exit 0", tone: "dim" },
        ],
      },
    ],
  };
})();
