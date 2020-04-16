/* eslint-env node */
const Crawler = require('simplecrawler');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');

const utility = require ('./utility.js');
const Operations = require ('./operations.js');
const ops = new Operations();

let scanDir = null;

module.exports = class Compare {

	async do(response){
		let pages = {};
		let spinners = {};
		let fourohfour = [];
		let slug = utility.getSlugFromURL(response.url);
	
		scanDir = path.resolve(process.cwd(), 'scans', slug);
		utility.verifyDir(scanDir);

		if ( response.reuse ) {
			pages = JSON.parse(fs.readFileSync('lastcrawl.json'));
			await this.finish(pages, response, spinners);
		} else {
			let crawler = new Crawler(response.url)
				.on('fetchstart', (item) => {
					spinners = utility.startCrawlSpin(spinners, item);
				}).on('fetchcomplete', (item, buffer, resp) => {
					if (resp.headers['content-type'].includes('html')){
						pages[item.url] = buffer;
						spinners[item.url].succeed();
						if (response.scanType.includes('text')) {
							const opts = {
								url: item.url, 
								base: response.url, 
								responseBuffer: buffer,
								scanDir,
								dir: 'txt'
							};
							ops.text(opts);
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
				}).on('complete', async () => {
					await this.finish(pages, response, spinners, fourohfour);
				});

			crawler.maxDepth = response.deep ? 0 : 1;
			crawler.stripQuerystring = true;

			crawler = utility.filterCrud(crawler);

			response.cookies.forEach(cookie => {
				if (cookie) {
					crawler.cookies.add(...cookie);
				}
			});			
			crawler.start();	
		}
	}

	async finish(pages, response, spinners, fourohfour) {
		utility.clearSpinners(spinners);
		console.log(chalk.green('Finished crawling!'));

		if (response.scanType.includes('screenshots')) {
			await ops.screenshots({
				pages, 
				response,
				scanDir
			});
		}
		if (response.scanType.includes('validate')) {
			await ops.validateHTML({
				pages
			});
		}
		if (response.scanType.includes('404') && fourohfour && fourohfour.length && !response.reuse) {
			ops.fourOhs({
				fourohfour,
				scanDir
			});
		}
		if (response.reuse && response.scanType.includes('404') ) {
			ora(chalk.red('Not performing a 404 scan with the "Reuse Crawl" option selected. If you need a 404 report, please re-run the crawl.')).fail();	
		}
	
		fs.writeFileSync('lastcrawl.json', JSON.stringify(pages));	
	}
};
