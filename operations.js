/* eslint-env node */
const path = require('path');
const fs = require('fs');
const htmlToText = require('html-to-text');
const chalk = require('chalk');
const validator = require('html-validator');
const ora = require('ora');

const shots = require ('./screenshots.js');
const utility = require ('./utility.js');

module.exports = class Operations {
	async text(options){
		const defaults = {
			url: '', 
			base: '', 
			responseBuffer: new ArrayBuffer(0),
			dir: 'txt',
			scanDir: ''
		};
		const opts = Object.assign(defaults, options);
		const date = Math.floor(new Date().valueOf() / 100000).toString();
		const fullPath = path.resolve(opts.scanDir, opts.dir, date);
		const filename = utility.createFilename(opts.url, opts.base, opts.dir);	
		const sep = '*********************************************************************\n';
		let output = '';

		utility.verifyDir(fullPath);

		output += sep;
		output += `**************${opts.url}**************\n`;
		output += sep;            

		output += htmlToText.fromString(opts.responseBuffer.toString(), {
			ignoreImage: true,
			wordwrap: false
		});

		fs.writeFileSync(path.resolve(fullPath, filename), output, (err) =>{
			if (err) console.log(err);
		});
		console.log(chalk.green(`${opts.url} converted to text.`));
	}

	fourOhs(options){
		const defaults = {
			fourohfour: [], 
			scanDir: ''
		};
		const opts = Object.assign(defaults, options);		
		ora(chalk.red('Found 404s...')).fail();

		const filepath = path.resolve(opts.scanDir, '404.txt');
		const spin2 = ora(chalk.green('Outputting 404s')).start();
		fs.writeFileSync(filepath, opts.fourohfour.reduce((prev, curr) => {
			return prev + curr.referrer + ': ' + curr.url + '\n';
		}, ''));

		spin2.succeed();	
	}

	async screenshots(options){
		const defaults = {
			pages: {},
			response: {},
			scanDir: ''
		};
		const opts = Object.assign(defaults, options);		
	
		const pages = Object.keys(opts.pages);
		for(let i=0; i < pages.length; i++){
			await shots.getScreenshot(pages[i], opts.response.url, opts.scanDir);
		}
		console.log(chalk.green('Finished screenshotting!'));	
	}

	async validateHTML(options){
		const defaults = {
			pages: {},
			validatorOpts: {
				format: 'json',
				validator: 'WHATWG',				
				isLocal: true,
			}
		};
		const opts = Object.assign(defaults, options);

		const pages = Object.keys(opts.pages);
		for(let i=0; i < pages.length; i++){
			let url = pages[i];
		
			const spin = ora(`Running HTML Validator for ${url}`).start();
			let errors = '';    
			try{
				opts.validatorOpts.url = url;
				let test = await validator(opts.validatorOpts);
				test.errors.forEach(error => {
				// if(message.type == 'error'){
					errors += `${error.message} Line: ${error.line} Severity: ${error.severity}\n\r`;
				// }
				});
				if(errors.length){
					throw Error('Validation failed');
				}
				spin.succeed();            
			}catch (e){
				spin.fail();       
				console.log(chalk.bgRed.bold(e.message));
				console.log('              ' + chalk.gray(errors));
			}
		}
		return;
	}
};