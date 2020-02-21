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
		}]
	},
]

const compare = [
	{
		type: 'text',
		message: 'Enter URL 1',
		name: 'url1'
	},
	{
		type: 'text',
		message: 'Enter URL 2',
		name: 'url2'
	},	
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
		}]
	},
	{
		type: 'text',
		message: 'Enter a URL',
		name: 'url'
	},
	{
		type: 'confirm',
		message: 'Do a deep crawl?',
		initial: false,
		name: 'deep'
	}
]

exports.scan = scan;
exports.compare = compare;
exports.actionType = actionType;