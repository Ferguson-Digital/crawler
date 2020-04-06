const chalk = require("chalk");
const ora = require("ora");
const puppeteer = require("puppeteer");

const path = require("path");

const utility = require ('./utility.js');

const views = {
	desktop: {
		height: 1080,
		width: 1920,
	},
	mobile: {
		isMobile: true,
		hasTouch: true,
		deviceScaleFactor: 2,
		width: 414,
		height: 736,
	},
};

exports.getScreenshotImg = async function getScreenshotImg(
	url,
	fullPage,
	type
) {
	const spin = ora(chalk.blue(`Screenshotting ${url}`));
	spin.start();

	try {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setViewport(views.desktop);

		const response = await page.goto(url);

		if (response.status() === 200) {
			const pic = await page.screenshot({
				fullPage,
				type,
				quality: type === "jpeg" ? 100 : null,
			});

			await browser.close();
			spin.succeed();
			return pic;
		} else {
			spin.warn();
			return false;
		}
	} catch (err) {
		console.log(err);
		spin.fail();
		process.exit();
	}
};

exports.getScreenshot = async function getScreenshot(url, base, folder) {
	const spin = ora(chalk.blue(`Screenshotting ${url}`));
	try {
		const date = Math.floor(new Date().valueOf() / 100000).toString();
		const dir = "pdf";
		const fullPath = path.resolve(folder, dir, date);
		const filename = utility.createFilename(url, base, dir);
		const fileSaved = path.resolve(folder, dir, date, filename);
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

		spin.start();
		utility.verifyDir(fullPath);

		await page.setViewport(views.desktop);
		await page.emulateMedia("screen"); // we want to be a computer not a printer
		await page.goto(url);

		await page.pdf({
			path: fileSaved,
			displayHeaderFooter: true,
			printBackground: true,
			...views.desktop,
		});
		await browser.close();
		spin.succeed();

		return fileSaved;
	} catch (err) {
		console.log(err);
		spin.fail();
		process.exit();
	}
};
