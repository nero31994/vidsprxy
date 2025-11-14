import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";

export default async function handler(req, res) {
  const embedUrl = req.query.url;
  if (!embedUrl) return res.status(400).send("Missing ?url=<VidSrc embed>");

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,
      headless: true
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );

    // Intercept requests to capture first .m3u8
    let m3u8Url = null;
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const url = request.url();
      if (url.endsWith(".m3u8") && !m3u8Url) {
        m3u8Url = url;
        request.abort(); // optionally abort request
      } else {
        request.continue();
      }
    });

    await page.goto(embedUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait a few seconds for player JS to fetch m3u8
    await page.waitForTimeout(5000);

    if (!m3u8Url) return res.status(404).send("No m3u8 found");

    // Redirect user directly to m3u8
    res.writeHead(302, { Location: m3u8Url });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Error: " + err.message);
  } finally {
    if (browser) await browser.close();
  }
}
