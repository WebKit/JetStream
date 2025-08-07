const React = require('react');
const { renderToString } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const { WineList } = require('./components.cjs');
const { WINE_DATA } = require("./wine-data.cjs");

function renderTest() {
  const start = performance.now();
  const html = renderToString(<WineList wines={WINE_DATA} />);
  const end = performance.now(start);

  const duration = end - start;
  console.log(`renderToString took ${duration.toFixed(2)}ms`);

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const wineCardCount = doc.querySelectorAll('.wine-card').length;
  const solidTagCount = doc.evaluate("count(//a[text()='solid'])", doc, null, dom.window.XPathResult.NUMBER_TYPE, null).numberValue;

  return {
    duration,
    html: html,
    wineCardCount,
    solidTagCount,
  };
}

module.exports = {
  renderTest
}