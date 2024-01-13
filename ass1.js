const puppeteer = require("puppeteer");
const fs = require("fs");
const csv = require("fast-csv");

async function scrapeToolData() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const url = "https://www.tines.com/library/tools";
  await page.goto(url);

  const toolsData = [];

  try {
    while (true) {
      console.log("Scraping page");
      await page.waitForSelector("table tbody tr");
      const tools = await page.$$("table tbody tr");
      //console.log(tools);
      for (const tool of tools) {
        const toolName = await tool.$eval("th a", (el) =>
          el.textContent.trim()
        );
        console.log(toolName);
        const numStories = await tool.$eval("xpath=td[2]", (el) =>
          el.textContent.trim()
        );
        toolsData.push([toolName, numStories]);
      }

      const nextButton = await page.$x(
        '//*[@id="gatsby-focus-wrapper"]//button[contains(text(), "Next")]'
      );

      const isDisabled = await page.$eval(
        'xpath=//*[@id="gatsby-focus-wrapper"]//button[contains(text(), "Next")]',
        (el) => el.classList.contains("disabled")
      );
      if (isDisabled) {
        break; // Exit loop if the next button is not found (last page)
      }

      await nextButton[0].click();
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  } catch (e) {
    console.error(`Error occurred: ${e.toString()}`);
  } finally {
    await browser.close();

    // Save data to CSV
    const ws = fs.createWriteStream("tool_data.csv", {
      encoding: "utf-8",
      flags: "w",
    });
    const csvStream = csv.format({ headers: true });

    csvStream
      .pipe(ws)
      .on("end", () => {
        console.log("CSV file written successfully.");
      })
      .on("error", (err) => {
        console.error(`Error writing CSV: ${err}`);
      });

    csvStream.write(["Tool Name", "Number of Stories"]);
    toolsData.forEach((row) => csvStream.write(row));

    csvStream.end();
  }
}

scrapeToolData();
