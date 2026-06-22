const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('c:/Users/aradh/OneDrive/Desktop/anant bhaiya/index.html', 'utf-8');
const js = fs.readFileSync('c:/Users/aradh/OneDrive/Desktop/anant bhaiya/app.js', 'utf-8');

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
const document = window.document;
global.window = window;
global.document = document;
global.navigator = window.navigator;

try {
    window.eval(js);
    window.runActualGasCalculations();
    console.log("Calculations ran successfully!");
} catch (e) {
    console.error("ERROR CAUGHT:");
    console.error(e.stack);
}
