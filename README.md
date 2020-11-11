# crawler
## Crawl websites and do fun things ##

This project is a somewhat-fleshed-out crawler that does a few things:
1. Scans websites (404s, takes screenshots, scrapes text, validates HTML) or 
1. Compares websites by taking screenshots and do a graphical comparison

It is not meant as a full-featured replacement for a test suite like Selenium or anything like that - it mostly exists for when somebody dashes into your office and says "we need to have the text ripped off a website for translation in the next 19 seconds!" or "we need PDFs of the entire site ready for legal review by the time the clock strikes noon!". And yes, these are two actual requests that resulted in the very first cobbled-together version of this script that gradually morphed into something more silly. 

**In reality, the "Site Compare" option was created mostly as a fun trial, and if you need anything more serious for CI/CD or anything like that, definitely use a more appropriate tool.**

## To Run ##
`node index.js`
Follow the onscreen prompts. Any reports or other outputs will be placed inside ```<scandirectory>/<scans|compare>/<domain>/<results files>```. The outputs include files like ```404.txt``` or ```compare.html```. Some reports (HTML validity, for instance), purely output to the console. Some sites may require a cookie in order to get past a login wall, so you may enter that info as well.

## Screenshots ##
### Compare two sites ###
![Compare](/screenshots/compare.png?raw=true "Compare")

### Comparison results (console) ###
![Different Comparisons](/screenshots/some-different.png?raw=true "Live and Dev are different")

### Comparison results (HTML report) ###
![Site Compare Report](/screenshots/sitediff.png?raw=true "Site Compare Report")

### Extract data from one site ###
![Scan](/screenshots/scan.png?raw=true "Scan Options")

### Validate the HTML ###
![Validation](/screenshots/validation.png?raw=true "HTML Validation failed")

### Scan for 404s ###
![404](/screenshots/404s.png?raw=true "404 Errors")

### Make PDF screenshots (of the entire site, if you choose!) ###
![Scan - Screenshot](/screenshots/screenshot.png?raw=true "Scan - Screenshot")

### Extract the text from a whole site ###
![Scan - Text Scrape Files](/screenshots/site-text.png?raw=true "Scan - Text Scrape Files")

### Each text output is converted to markdown-ish ###
![Scan - Text Scrape Output](/screenshots/text-scrape.png?raw=true "Scan - Text Scrape Output")
