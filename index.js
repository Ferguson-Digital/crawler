/* eslint-env node */
const prompts = require('prompts');
const fs = require('fs');

const questions = require('./questions.js');
const Scan = require ('./scan.js');
const scan = new Scan();

const Compare = require ('./compare.js');
const compare = new Compare();
run();

async function run(){
	let response = await prompts(questions.actionType);
	response.params = {};
	let loaded = false;
	if ( response.action === 'load') {
		response = JSON.parse(fs.readFileSync('./lastrun.json'));
		const crawlExists = fs.existsSync('./lastcrawl.json');

		if ( crawlExists ) {
			Object.assign(response.params, await prompts(questions.reuse));
		}

		loaded = true;
	}
	if (response.action && !loaded) {
		if (response.action === 'scan'){
			Object.assign(response.params, await prompts(questions.scan));
		}
		if (response.action === 'compare') {
			Object.assign(response.params, await prompts(questions.compare));
		}
	}

	if ( response.params.cookies ) {
		response.params.cookies = response.params.cookies.map( cookie => {
			if (cookie && typeof cookie === 'string') {
				const cook = cookie.split('=>');
				if ( cook[0].length && cook[1].length ){
					return [ cook[0], cook[1], Date.now() * 2 ]
				}
			}
		}).filter(cookie => cookie);
	}

	switch (response.action) {
	case 'scan' :
		scan.do(response.params);
		break;
	case 'compare' :
		compare.do(response.params);
		break;
	}
	fs.writeFileSync('./lastrun.json', JSON.stringify(response));
}








