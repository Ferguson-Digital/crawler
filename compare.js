/* eslint-env node */
const Crawler = require('simplecrawler');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const utility = require ('./utility.js');
const compareImages = require('resemblejs/compareImages');

const shots = require ('./screenshots.js');

let compareDir = null;

module.exports = class Compare {
	async do(response) {		
		let spinners = {};
		let sitePairs = [];

		if (response.reuse) {
			sitePairs = JSON.parse(fs.readFileSync('lastcrawl.json'));
			await this.finish(sitePairs, response, spinners);
		} else {
			let crawler = new Crawler(response.url1)
				.on('fetchstart', (item) => {
					spinners = utility.startCrawlSpin(spinners, item);
				}).on('fetchcomplete', (item, buffer, resp) => {
					if (resp.headers['content-type'].includes('html')){
						spinners[item.url].succeed();
						sitePairs.push({
							url1: item.url,
							url2: item.url.replace(response.url1, response.url2)
						});
					} else {
						spinners[item.url].fail(`HTML content-type not found at ${item.url}.`);
					}
				}).on('fetcherror', (item) => {
					spinners[item.url].fail(`Couldn't fetch ${item.url}`);
				}).on('fetchredirect', (item) => {
					spinners[item.url].warn(`Followed a redirect for ${item.url}`);
				}).on('complete', async () => {
					await this.finish(sitePairs, response, spinners);
				});
			response.cookies.forEach(cookie => {
				crawler.cookies.add(...cookie);
			});
		
			crawler.maxDepth = response.depth;
			crawler.stripQuerystring = false;

			crawler = utility.filterCrud(crawler);

			crawler.start();			
		}
	}

	async finish(sitePairs, response, spinners){
		utility.clearSpinners(spinners);
		const boot = '<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">';
		let out = `<html><head>${boot}</head><body><table class="table"><tr><td>URL</td><td>Diff Percentage</td><td>Image</td></tr>`;
		for(let i = 0; i < sitePairs.length; i++){
			let compared = await this.run(sitePairs[i], response);
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
	
		fs.writeFileSync('lastcrawl.json', JSON.stringify(sitePairs));
		const outFull = path.resolve(compareDir, 'compare.html');

		fs.writeFileSync(outFull, out);
		console.log(`Report available at ${outFull}`);	
	}

	async run(compare, response){
		const slug = utility.getSlugFromURL(compare.url1);
		const path1 = utility.cleanSlashes(utility.getUrlParts(compare.url1)[5]);
		compareDir = path.resolve(process.cwd(), 'compare', slug);

		const file2 = await shots.getScreenshotImg(compare.url2, response.full, 'jpeg');

		if ( file2 ){ // doesn't 404 on URL2
			const file1 = await shots.getScreenshotImg(compare.url1, response.full, 'jpeg');
			const options = {
				output: {
					errorColor: {
						red: 255,
						green: 0,
						blue: 255
					},
					errorType: 'flat',
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
			const outputFolder = 'differences';
			const outputPath = path.resolve(compareDir, outputFolder, `${path1}.png`);
			let msg;

			utility.verifyDir(path.resolve(compareDir, outputFolder));

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
};