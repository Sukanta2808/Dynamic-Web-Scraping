const puppeteer = require('puppeteer');
const fs = require('fs');
const csv = require('fast-csv');

async function scrapeToolData(page) {
    const toolsData = [];

    try {
        while (true) {
            console.log('Scraping tool data');

            await page.waitForSelector('table tbody tr');

            const tools = await page.$$('table tbody tr');

            for (const tool of tools) {
                const toolName = await tool.$eval('th a', el => el.textContent.trim());
                toolsData.push(toolName.toLowerCase().replace(/ /g, '-').replace(/\./g, '-'));
            }

            const isDisabled = await page.$eval('xpath=//*[@id="gatsby-focus-wrapper"]//button[contains(text(), "Next")]', el => el.classList.contains('disabled'));

            if (isDisabled) {
                break; // Exit loop if the next button is disabled (last page of tools)
            }

            const nextButton = await page.$x('//*[@id="gatsby-focus-wrapper"]//button[contains(text(), "Next")]');
            await nextButton[0].click();
            await page.waitForTimeout(3000);
        }
    } catch (e) {
        console.error(`Error occurred while scraping tools: ${e.toString()}`);
    }

    return toolsData;
}

async function scrapeToolStories() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const url = 'https://www.tines.com/library/tools';
    await page.goto(url);

    const allToolStories = [];

    try {
        while (true) {
            console.log('Scraping tool data');
            const toolNames = await scrapeToolData(page);

            for (const toolName of toolNames) {
                const toolStories = [];
                const toolUrl = `https://www.tines.com/library/tools/${toolName}`;
                await page.goto(toolUrl);
                await new Promise((resolve) => setTimeout(resolve, 3000));

                // Check if the tool URL leads to a redirection
                if (page.url() !== toolUrl) {
                    const toolUrlAlternative = `https://www.tines.com/library/tools/${toolName.replace(/-/g, '')}`;
                    await page.goto(toolUrlAlternative);
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }

                // Check if stories are present for the tool
                try {
                    await page.waitForSelector("table tbody tr");
                    await page.waitForSelector('table tbody tr', { timeout: 5000 });
                } catch {
                    continue; // Skip to the next tool if stories are not present
                }

                while (true) {
                    await page.waitForSelector("table tbody tr");
                    const stories = await page.$$('table tbody tr');

                    for (const story of stories) {
                        const storyName = await story.$eval('th a', el => el.textContent.trim());
                        const numActions = await story.$eval('xpath=./td[3]', el => el.textContent.trim());
                        
                        const worksWith = await story.$$('xpath=./td[2]/a');
                        let tool = [];
                        for (const work of worksWith) {
                            const toolitem = await work.$eval('xpath=./div/div[2]/div/span', el => el.textContent.trim());
                            tool.push(toolitem);
                        }

                        let author = '';
                        try {
                            author = await story.$eval('xpath=./td[4]/strong', el => el.textContent.trim());
                        } catch {
                            // Handle the case where the author is not present
                        }

                        console.log([toolName, storyName, tool, numActions, author]);
                        toolStories.push([toolName, storyName, tool, numActions, author]);
                    }

                    // Attempt to find and click the 'Next' button if it exists and is visible
                    try {
                        const isDisabled = await page.$eval('xpath=//*[@id="gatsby-focus-wrapper"]/div/div[1]/div/div/div[2]/div/div[2]/div/div[2]/div[2]/button', el => el.classList.contains('disabled') || el.classList.contains('invisible'));

                        if (isDisabled) {
                            break; // Exit loop if the next button is disabled (last page of stories)
                        }

                        const nextButton = await page.$x('//*[@id="gatsby-focus-wrapper"]/div/div[1]/div/div/div[2]/div/div[2]/div/div[2]/div[2]/button');
                        await nextButton[0].click();
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                    } catch {
                        break; // Exit loop if the 'Next' button is not found or visible
                    }
                }

                allToolStories.push(...toolStories);
            }

            // Attempt to find and click the 'Next' button if it exists and is visible
            try {
                const isDisabled = await page.$eval('xpath=//*[@id="gatsby-focus-wrapper"]//button[contains(text(), "Next")]', el => el.classList.contains('disabled') || el.classList.contains('invisible'));

                if (isDisabled) {
                    break; // Exit loop if the next button is disabled (last page of tools)
                }

                const nextButton = await page.$x('//*[@id="gatsby-focus-wrapper"]//button[contains(text(), "Next")]');
                await nextButton[0].click();
                await new Promise((resolve) => setTimeout(resolve, 3000));
            } catch {
                break; // Exit loop if the 'Next' button is not found or visible
            }
        }
    } catch (e) {
        console.error(`Error occurred while scraping stories: ${e.toString()}`);
    } finally {
        await browser.close();

        const ws = fs.createWriteStream('tool_stories.csv', { encoding: 'utf-8', flags: 'w' });
        const csvStream = csv.format({ headers: true });

        csvStream.pipe(ws)
            .on('end', () => {
                console.log('CSV file written successfully.');
            })
            .on('error', (err) => {
                console.error(`Error writing CSV: ${err}`);
            });

        csvStream.write(['Tool-name', 'Story','Works with', 'No. of actions', 'Author']);
        allToolStories.forEach(row => csvStream.write(row));

        csvStream.end();
    }
}

scrapeToolStories();
