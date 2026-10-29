const { chromium } = require("playwright");
const out = process.argv[2], N = +process.argv[3] || 630;
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: +(process.env.W || 1920), height: +(process.env.H || 1080) } });
  await p.goto("http://127.0.0.1:8765/" + (process.env.PAGE || "comp.html"));
  await p.evaluate(() => window.ready);
  for (let i = 0; i < N; i++) {
    await p.evaluate((t) => window.render(t), i / 30);
    await p.screenshot({ path: `${out}/f${String(i).padStart(4, "0")}.png` });
    if (i % 100 === 0) console.log(i);
  }
  await b.close();
})();
