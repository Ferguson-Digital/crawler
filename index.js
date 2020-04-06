const prompts = require('prompts');
const Crawler = require("simplecrawler");
const chalk = require('chalk');
const ora = require('ora');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const htmlToText = require('html-to-text');
const validator = require('html-validator');
const compareImages = require("resemblejs/compareImages");

const questions = require('./questions.js');
const views = {
	desktop: {
		height: 1080,
		width: 1920
	},
	mobile: {
		isMobile: true,
		hasTouch: true,
		deviceScaleFactor: 2,
		width: 414,
		height: 736
	}
}
let scanDir = null;
let compareDir = null;

run();

async function run(){
	let response = await prompts(questions.actionType);
	
	if (response.action === 'scan'){
		response = await prompts(questions.scan);
		doScan(response);
	} else if (response.action === 'compare'){
		response = await prompts(questions.compare);
		
		let spinners = {};
		let sitePairs = [];
		let crawler = new Crawler(response.url1)
			.on('fetchstart', (item) => {
				spinners = startCrawlSpin(spinners, item);
			}).on('fetchcomplete',(item,buffer,resp) => {
				if (resp.headers["content-type"].includes("html")){
					spinners[item.url].succeed();
					sitePairs.push({
						url1: item.url,
						url2: item.url.replace(response.url1,response.url2)
					})
				} else {
					spinners[item.url].fail(`HTML content-type not found at ${item.url}.`);
				}
			}).on('fetcherror', (item) => {
				spinners[item.url].fail(`Couldn't fetch ${item.url}`);
			}).on('fetchredirect', (item) => {
				spinners[item.url].warn(`Followed a redirect for ${item.url}`);
			}).on('complete',async () => {
				clearSpinners(spinners);
				const boot = '<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">';
				let out = `<html><head>${boot}</head><body><table class="table"><tr><td>URL</td><td>Diff Percentage</td><td>Image</td></tr>`;
				for(let i = 0; i < sitePairs.length; i++){
					let compared = await doCompare(sitePairs[i], response);
					let a = `<a href='${sitePairs[i].url1}'>${sitePairs[i].url1}</a> <br/> <a href='${sitePairs[i].url2}'>${sitePairs[i].url2}</a>`;
					if ( compared && compared.data.rawMisMatchPercentage > 0 ) {
						out += `<tr><td class='table-danger'>${a}</td><td>${compared.data.rawMisMatchPercentage}%</td><td><img class='img-fluid' src='${compared.data.getImageDataUrl()}'></td></tr>`;
					} else if (compared && compared.data.rawMisMatchPercentage === 0){
						out += `<tr><td class='table-success'>${a}</td><td>100%</td><td>All good!</td></tr>`;												
					} else if (!compared) {
						out += `<tr><td class='table-warning'>${a}</td><td>100%</td><td>No screenshot - URL2 doesn't exist!</td></tr>`;						
					} 
				}
				out += '</table></body></html>';
				
				const outFull = path.resolve(compareDir,'compare.html');

				fs.writeFileSync(outFull,out);
				console.log(`Report available at ${outFull}`);
			});

		crawler.maxDepth = response.depth;
		crawler.stripQuerystring = true;

		crawler = filterCrud(crawler);

		crawler.start();
		
	}
}

async function doCompare(compare, response){
	const slug = getSlugFromURL(compare.url1);
	const path1 = cleanSlashes(getUrlParts(compare.url1)[5]);
	const path2 = cleanSlashes(getUrlParts(compare.url2)[5]);
	compareDir = path.resolve(process.cwd(),'compare',slug);

	const file2 = await getScreenshotImg(compare.url2, response.full, 'jpeg');

	if ( file2 ){ // doesn't 404 on URL2
		const file1 = await getScreenshotImg(compare.url1, response.full, 'jpeg');
		const options = {
			output: {
				errorColor: {
					red: 255,
					green: 0,
					blue: 255
				},
				errorType: "flat",
				transparency: 0.4,
				largeImageThreshold: 1900,
				useCrossOrigin: false,
				outputDiff: true
			},
			scaleToSameSize: true,
			// ignore: "antialiasing"
		};
	
		const data = await compareImages(
			file1,
			file2,
			options
		);

		const fold = response.full ? '' : ' (at least above the fold)';
		const outputFolder = 'differences'
		const outputPath = path.resolve(compareDir,outputFolder,`${path1}.png`);
		let msg;

		verifyDir(path.resolve(compareDir,outputFolder));

		if ( data.rawMisMatchPercentage > 10 ){
			msg = chalk.red(`${compare.url1} is different than ${compare.url2}!`);
			fs.writeFileSync(outputPath, data.getBuffer());
		} else if (data.rawMisMatchPercentage > 0) {
			msg = chalk.yellow(`${compare.url1} is close to ${compare.url2}!`);
			fs.writeFileSync(outputPath, data.getBuffer());
		} else {
			msg = chalk.green(`${compare.url1} is identical to ${compare.url2} ${fold}!`);
		}
		console.log(msg);		
		return {
			data,
			outputPath
		};
	} else {
		return false;
	}
}

async function getScreenshotImg(url, fullPage, type){
	const spin = ora(chalk.blue(`Screenshotting ${url}`));	
	spin.start();

	try{
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setViewport(views.desktop);
		
		const response = await page.goto(url);
		
		if ( response.status() === 200 ) {
			const pic = await page.screenshot({
				fullPage,
				type,
				quality: type === 'jpeg' ? 100 : null
			});

			await browser.close();
			spin.succeed();
			return pic;
		} else {
			spin.warn();
			return false;
		}


	}catch (err) {
		console.log(err);
		spin.fail();
		process.exit();
	}
}
function doScan(response){
	let pages = {};
	let spinners = {};
	let fourohfour = [];
	let slug = getSlugFromURL(response.url);
	
	scanDir = path.resolve(process.cwd(),'scans',slug);
	verifyDir(scanDir);

	var crawler = new Crawler(response.url)
		.on('fetchstart', (item) => {
			spinners = startCrawlSpin(spinners, item);
		}).on('fetchcomplete',(item,buffer,resp) => {
			if (resp.headers["content-type"].includes("html")){
				pages[item.url] = buffer;
				spinners[item.url].succeed();
				if (response.scanType.includes("text")) {
					text(item.url,response.url,buffer);
				}
			} else {
				spinners[item.url].fail(`HTML content-type not found at ${item.url}.`);
			}
		}).on('fetcherror', (item) =>{
			spinners[item.url].fail(`Couldn't fetch ${item.url}`);
		}).on('fetchredirect', (item) => {
			spinners[item.url].warn(`Followed a redirect for ${item.url}`);
		}).on('fetch404', (item) =>{
			spinners[item.url].warn(`404 Not Found: ${item.url}`);
			fourohfour.push(item);
		}).on('complete',async () => {
			clearSpinners(spinners);
			console.log(chalk.green('Finished crawling!'));

			if (response.scanType.includes("screenshots")) {
				await screenshots(pages,response);
			}
			if (response.scanType.includes("validate")) {
				await validateHTML(pages);
			}
			if (response.scanType.includes("404") && fourohfour.length) {
				fourOhs(fourohfour);
			}

		})

	crawler.maxDepth = response.deep ? 0 : 1;
	crawler.stripQuerystring = true;

	crawler = filterCrud(crawler);
	crawler.start();	
}

function fourOhs(fourohfour){
	ora(chalk.red(`Found 404s...`)).fail();

	const filepath = path.resolve(scanDir,'404.txt');
	const spin2 = ora(chalk.green(`Outputting 404s`)).start();
	fs.writeFileSync(filepath,fourohfour.reduce((prev,curr) => {
		return prev + curr.referrer + ": " + curr.url + "\n"
	},''))

	spin2.succeed();	
}
async function text(url,base,responseBuffer){
	const dir = 'txt';
	const date = Math.floor(new Date().valueOf() / 100000).toString();
	const fullPath = path.resolve(scanDir,dir,date);
	const filename = createFilename(url,base,dir);	
	const sep = `*********************************************************************\n`;
	let output = '';

	verifyDir(fullPath);

	output += sep;
	output += `**************${url}**************\n`;
	output += sep;            

	output += htmlToText.fromString(responseBuffer.toString(),{
		ignoreImage: true,
		wordwrap: false
	});

	fs.writeFileSync(path.resolve(fullPath,filename),output,(err) =>{
		if (err) console.log(err);
	})	
	console.log(chalk.green(`${url} converted to text.`));
}

async function screenshots(p,response){
	const pages = Object.keys(p);
	for(let i=0; i < pages.length; i++){
		await getScreenshot(pages[i],response.url);
	}
	console.log(chalk.green('Finished screenshotting!'));	
}

async function getScreenshot(url, base, folder){
	const spin = ora(chalk.blue(`Screenshotting ${url}`));		
	try{
		const date = Math.floor(new Date().valueOf() / 100000).toString();
		const dir = 'pdf';
		const fullPath = path.resolve(folder || scanDir,dir,date);
		const filename = createFilename(url,base,dir);
		const fileSaved = path.resolve(folder || scanDir,dir,date,filename);		
		const browser = await puppeteer.launch();
		const page = await browser.newPage();		

		spin.start();
		verifyDir(fullPath);
		
		await page.setViewport(views.desktop);
		await page.emulateMedia('screen'); // we want to be a computer not a printer
		await page.goto(url);

		await page.pdf({
			path: fileSaved,
			displayHeaderFooter: true,
			printBackground: true,
			...views.desktop
		});
		await browser.close();	
		spin.succeed();

		return fileSaved;
	}catch (err) {
		console.log(err);
		spin.fail();
		process.exit();
	}
}

async function validateHTML(urls){
	const pages = Object.keys(urls);
	for(let i=0; i < pages.length; i++){
		let url = pages[i];
		
		const options = {
			url,
			format: 'json',
			validator: 'WHATWG',				
			isLocal: true,
		}
		
		const spin = ora(`Running HTML Validator for ${url}`).start();
		let errors = '';    
		try{
			let test = await validator(options);
			test.errors.forEach(error => {
				// if(message.type == 'error'){
				errors += `${error.message} Line: ${error.line} Severity: ${error.severity}\n\r`;
				// }
			})
			if(errors.length){
				throw Error('Validation failed');
			}
			spin.succeed();            
		}catch (e){
			spin.fail();       
			console.log(chalk.bgRed.bold(e.message));
			console.log("              " + chalk.gray(errors));
		}
	}
    return;
}

/*
.##.....##.########.####.##.......####.########.##....##
.##.....##....##.....##..##........##.....##.....##..##.
.##.....##....##.....##..##........##.....##......####..
.##.....##....##.....##..##........##.....##.......##...
.##.....##....##.....##..##........##.....##.......##...
.##.....##....##.....##..##........##.....##.......##...
..#######.....##....####.########.####....##.......##...
*/


function createFilename(url,base,extension){
	let filename = url === base ? url : url.replace(base,'');
	filename = filename.replace(/\/$/, "").replace(/\W+/g, '_'); // cleanup trailing slashes and convert non-words to underscore

	return `${filename}.${extension}`;
}

function getSlugFromURL(url){
	let slugSearch = /^(?:http|https)(?:\W+)(?:www.)*(\w+)/;
	return slugSearch.exec(url)[1];
}

function getUrlParts(url){
	let regex = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
	return regex.exec(url);
}

function cleanSlashes(str){
	// remove leading/trailing slashes and replace the remainder of non-word characters with dashes
	let ret = str.replace(/^\/|\/$/g, '').replace(/(\W+)/g,'-');

	return ret.length > 0 ? ret : "root";
}

function startCrawlSpin(spinners, item){
	spinners[item.url] = ora(chalk.blue(`Loading ${item.url}`));
	spinners[item.url].start();	

	return spinners;
}

function clearSpinners(spinners){
	Object.keys(spinners).forEach(key => {
		if (spinners[key] && spinners[key].isSpinning){
			const url = spinners[key].text.toLowerCase().replace('loading ','');
			const text  = `Warning: ${url} didn't finish for some reason.`;
			spinners[key].warn(text);
		}
	});
}

function filterCrud(crawler){
	crawler.addFetchCondition( (parsedURL) => {
		if (parsedURL.path.match(/\.(css|jpg|pdf|docx|js|png|ico|svg)/i)) {
			return false;
		}
		return true;
	});

	return crawler;
}

function verifyDir(dir){
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir,{recursive:true});
	}	
}