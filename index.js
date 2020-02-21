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

let scanDir = null;
let compareDir = null;

run();

async function run(){
	let response = await prompts(questions.actionType);
	
	if (response.action === 'scan'){
		response = await prompts(questions.scan);
		doScan(response);
	} else if (response.action === 'compare'){
		// response = await prompts(questions.compare);
		response.url1 = 'https://www.kmccontrols.com/';
		response.url2 = 'https://kmc.fergdev.com/';
		
		let spinners = {};
		let sitePairs = [];
		let crawler = new Crawler(response.url1)
			.on('fetchstart', (item) => {
				spinners[item.url] = ora(chalk.blue(`Loading ${item.url}`));
				spinners[item.url].start();
			}).on('fetchcomplete',(item,buffer,resp) => {
				if (resp.headers["content-type"].includes("html")){
					spinners[item.url].succeed();
					sitePairs.push({
						url1: item.url,
						url2: item.url.replace(response.url1,response.url2)
					})
				} else {
					spinners[item.url].warn();
				}
			}).on('fetcherror', (item) =>{
				spinners[item.url].fail();
			}).on('complete',async () => {
				clearSpinners(spinners);
				for(let i = 0; i < sitePairs.length; i++){
					await doCompare(sitePairs[i]);
				}
				
			});

		crawler.maxDepth = 2;
		crawler.stripQuerystring = true;

		crawler.addFetchCondition( (parsedURL) => {
			if (parsedURL.path.match(/\.(css|jpg|pdf|docx|js|png|ico|svg)/i)) {
				return false;
			}
			return true;
		});

		crawler.start();
		
	}
}

async function doCompare(response){
	const dirRip = /^(?:http|https)(?:\W+)(\w+)/;
	const slug = dirRip.exec(response.url1)[1];
	const date = Math.floor(new Date().valueOf() / 100000).toString();
	compareDir = path.resolve(process.cwd(),'compare',slug);

	const file1 = await getScreenshotPng(response.url1, compareDir, slug + '_1');
	const file2 = await getScreenshotPng(response.url2, compareDir, slug + '_2');

	const options = {
        output: {
            errorColor: {
                red: 255,
                green: 0,
                blue: 255
            },
            errorType: "flat",
            transparency: 0.6,
            largeImageThreshold: 1200,
            useCrossOrigin: false,
            outputDiff: false
        },
        scaleToSameSize: true,
        ignore: "antialiasing"
    };
 
    const data = await compareImages(
        file1,
        file2,
        options
    );

	if ( data.rawMisMatchPercentage > 10 ){
		console.log(chalk.red(`${response.url1} is different than ${response.url2}!`));
		fs.writeFileSync(path.resolve(compareDir,`output_${slug}_${date}.png`), data.getBuffer());
	} else if (data.rawMisMatchPercentage > 0) {
		console.log(chalk.yellow(`${response.url1} is close to ${response.url2}!`));
		fs.writeFileSync(path.resolve(compareDir,`output_${slug}_${date}.png`), data.getBuffer());
	} else {
		console.log(chalk.green(`${response.url1} is identical to ${response.url2}!`));
	}
    fs.writeFileSync(path.resolve(compareDir,`output_${date}.png`), data.getBuffer());
}

async function getScreenshotPng(url, dir, file){
	const spin = ora(chalk.blue(`Screenshotting ${url}`));	
	const date = Math.floor(new Date().valueOf() / 100000).toString();
	const type = 'jpeg';
	const fullPath = path.resolve(dir,`${file}_${date}.${type}`);	
	const view = {
		height: 1080,
		width: 1920
	}
	spin.start();

	try{
		if (!fs.existsSync(dir)){
			fs.mkdirSync(dir,{recursive:true});
		}

		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		await page.setViewport(view);
		await page.goto(url);
		const pic = await page.screenshot({
			// path: fullPath,
			// fullPage: true
		});

		await browser.close();
		spin.succeed();
		return pic;

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
	let dirRip = /^(?:http|https)(?:\W+)(\w+)/;
	scanDir = dirRip.exec(response.url)[1];
	scanDir = path.resolve(process.cwd(),'scans',scanDir);

	if (!fs.existsSync(scanDir)){
		fs.mkdirSync(scanDir,{recursive: true});
	}

	var crawler = new Crawler(response.url)
		.on('fetchstart', (item) => {
			spinners[item.url] = ora(chalk.blue(`Loading ${item.url}`));
			spinners[item.url].start();
		}).on('fetchcomplete',(item,buffer,resp) => {
			if (resp.headers["content-type"].includes("html")){
				pages[item.url] = buffer;
				spinners[item.url].succeed();
				if (response.scanType.includes("text")) {
					text(item.url,response.url,buffer);
				}
			} else {
				spinners[item.url].warn();
			}
		}).on('fetcherror', (item) =>{
			spinners[item.url].fail();
		}).on('fetch404', (item) =>{
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

	crawler.addFetchCondition( (parsedURL) => {
		if (parsedURL.path.match(/\.(css|jpg|pdf|docx|js|png|ico)/i)) {
			return false;
		}
		return true;
	});

	crawler.start();	
}

function clearSpinners(spinners){
	Object.keys(spinners).forEach(key => {
		if (spinners[key] && spinners[key].isSpinning){
			spinners[key].warn();
		}
	});
}

function fourOhs(fourohfour){
	const spin = ora(chalk.red(`Found 404s...`));
	spin.fail();
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
	const sep = `*********************************************************************\n`;
	let output = '';

	if (!fs.existsSync(fullPath)){
		fs.mkdirSync(fullPath,{recursive: true});
	}

	output += sep;
	output += `**************${url}**************\n`;
	output += sep;            


	let text = htmlToText.fromString(responseBuffer.toString(),{
		ignoreImage: true,
		wordwrap: false
	});

	output += text.toString();
	let filename = createFilename(url,base,dir);
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

async function getScreenshot(url, base, folder,){
	const spin = ora(chalk.blue(`Screenshotting ${url}`));	
	try{
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
		const date = Math.floor(new Date().valueOf() / 100000).toString();
		const dir = 'pdf';
		const fullPath = path.resolve(folder || scanDir,dir,date);
		const view = {
			height: 1080,
			width: 1920
		}

		spin.start();
		await page.setViewport(view);
		if (!fs.existsSync(fullPath)){
			fs.mkdirSync(fullPath,{recursive:true});
		}
		await page.emulateMedia('screen'); // we want to be a computer not a printer
		await page.goto(url);

		let filename = createFilename(url,base,dir);
		let fileSaved = path.resolve(folder || scanDir,dir,date,filename);
		await page.pdf({
			path: fileSaved,
			displayHeaderFooter: true,
			printBackground: true,
			...view
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

function createFilename(url,base,extension){
	let filename = url === base ? url : url.replace(base,'');
	filename = filename.replace(/\/$/, "").replace(/\W+/g, '_'); // cleanup trailing slashes and convert non-words to underscore

	return `${filename}.${extension}`;
}

async function validateHTML(urls){
	const pages = Object.keys(urls);
	for(let i=0; i < pages.length; i++){
		let url = pages[i];
		const options = {
			url,
			format: 'json',
			isLocal: true
		}
		
		const spin = ora(`Running HTML Validator for ${url}`).start();
		let errors = '';    
		try{
			let test = await validator(options);
			test.messages.forEach(message => {
				if(message.type == 'error'){
					errors += `${message.message} Ending on line: ${message.lastLine}\n\r`;
				}
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