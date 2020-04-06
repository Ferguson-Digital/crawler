const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');

exports.createFilename = (url,base,extension) => {
	let filename = url === base ? url : url.replace(base,'');
	filename = filename.replace(/\/$/, "").replace(/\W+/g, '_'); // cleanup trailing slashes and convert non-words to underscore

	return `${filename}.${extension}`;
}

exports.getSlugFromURL = (url) => {
	let slugSearch = /^(?:http|https)(?:\W+)(?:www.)*(\w+)/;
	return slugSearch.exec(url)[1];
}

exports.getUrlParts = (url) => {
	let regex = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
	return regex.exec(url);
}

exports.cleanSlashes = (str) => {
	// remove leading/trailing slashes and replace the remainder of non-word characters with dashes
	let ret = str.replace(/^\/|\/$/g, '').replace(/(\W+)/g,'-');

	return ret.length > 0 ? ret : "root";
}

exports.startCrawlSpin = (spinners, item) => {
	spinners[item.url] = ora(chalk.blue(`Loading ${item.url}`));
	spinners[item.url].start();	

	return spinners;
}

exports.clearSpinners = (spinners) => {
	Object.keys(spinners).forEach(key => {
		if (spinners[key] && spinners[key].isSpinning){
			const url = spinners[key].text.toLowerCase().replace('loading ','');
			const text  = `Warning: ${url} didn't finish for some reason.`;
			spinners[key].warn(text);
		}
	});
}

exports.filterCrud = (crawler) => {
	crawler.addFetchCondition( (parsedURL) => {
		if (parsedURL.path.match(/\.(css|jpg|pdf|docx|js|png|ico|svg)/i)) {
			return false;
		}
		return true;
	});

	return crawler;
}

exports.verifyDir = (dir) => {
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir,{recursive:true});
	}	
}