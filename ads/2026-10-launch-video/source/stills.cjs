const { chromium } = require("playwright");
(async () => {
  const [out, ...times] = process.argv.slice(2);
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://127.0.0.1:8765/comp.html", { waitUntil: "load" });
  await p.evaluate(() => window.ready);
  for (const t of times) { await p.evaluate((t) => window.render(+t), t); await p.screenshot({ path: `${out}/still-${t}.png` }); }
  console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no errors");
  await b.close();
})();
