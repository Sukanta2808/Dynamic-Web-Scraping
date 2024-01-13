const puppeteer = require("puppeteer");
const fs = require("fs");
const csv = require("fast-csv");

async function scrapeToolData() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const url = "https://www.tines.com/library?view=all";
  await page.goto(url);

  const storiesData = [];

  try {
    while (true) {
      console.log("Scraping page");
      await page.waitForSelector("table tbody tr");
      const stories = await page.$$("table tbody tr");

      for (const story of stories) {
        const storyName = await story.$eval("th a", (el) =>
          el.textContent.trim()
        );

        const numActions = await story.$eval("xpath=td[3]", (el) =>
          el.textContent.trim()
        );
        const worksWith = await story.$$("xpath=./td[2]/a");
        let tool = [];
        for (const work of worksWith) {
          const toolitem = await work.$eval(
            "xpath=./div/div[2]/div/span",
            (el) => el.textContent.trim()
          );
          tool.push(toolitem);
        }

        let author = "";
        try {
          author = await story.$eval("xpath=./td[4]/strong", (el) =>
            el.textContent.trim()
          );
        } catch {
          // Handle the case where the author is not present
        }
        storiesData.push([storyName, tool, numActions, author]);
        console.log(storiesData)
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
    const ws = fs.createWriteStream("story_data.csv", {
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

    csvStream.write(["Story", "Works with", "No. of actions", "Author"]);
    storiesData.forEach((row) => csvStream.write(row));

    csvStream.end();
  }
}

scrapeToolData();
