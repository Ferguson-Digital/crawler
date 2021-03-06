/* eslint-env node */
const fs = require('fs');

const actionType = [
	{
		name: 'action',
		message: 'What are we doing?',
		type: 'select',
		choices: [
			{
				title: 'Scan',
				value: 'scan',
			},
			{
				title: 'Compare',
				value: 'compare',
				selected: true
			}
		]
	},
]

if (fs.existsSync('./lastrun.json')) {
	actionType[0].choices.unshift({
		title: 'Load Previous',
		value: 'load'
	});
}

const cookies = {
	type: 'list',
	name: 'cookies',
	message: 'Enter cookies, like name=>value, name=>value'
};

const reuse = {
	name: 'reuse',
	message: 'Reuse previous crawl URLs?',
	type: 'toggle',
	initial: true,
	active: 'yes',
	inactive: 'no'
};

const limit = {
	name: 'limit',
	message: 'Limit the number of pages',
	type: 'number'
};

const compare = [
	{
		type: 'text',
		message: 'Enter URL 1 (Probably Live)',
		name: 'url1'
	},
	{
		type: 'text',
		message: 'Enter URL 2 (Probably Dev)',
		name: 'url2'
	},
	cookies,
	{
		type: 'number',
		name: 'depth',
		message: 'How many levels deep should we go? \n1 == Just this page. 2 == This page and its direct links. 3+ == Good luck. \nCAUTION: On large sites, more than 2 levels can take a **very** long time.',
		initial: 1
	},
	{
		type: 'select',
		name: 'full',
		message: 'Compare the full screen, or just above the fold?',
		choices: [
			{
				title: 'Above the fold',
				value: false,
				selected: true
			},
			{
				title: 'Full Screen',
				value: true,
			}
		]		
	}
]

const scan = [
	{
		name: 'scanType',
		message: 'What are we scanning?',
		type: 'multiselect',
		choices: [
			{
				title: 'Screenshots',
				value: 'screenshots',
				selected: true
			},
			{
				title: 'Text Scrape',
				value: 'text'
			},
			{
				title: '404 Report',
				value: '404',
				selected: true
			},
			{
				title: 'Validate HTML',
				value: 'validate',
				selected: true
			}
		]
	},
	{
		type: 'text',
		message: 'Enter a URL',
		name: 'url'
	},
	cookies,
	{
		type: 'confirm',
		message: 'Do a deep crawl?',
		initial: false,
		name: 'deep'
	}
];

exports.scan = scan;
exports.compare = compare;
exports.reuse = reuse;
exports.limit = limit;
exports.actionType = actionType;