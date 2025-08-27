const UNITS = [
  "year",
  "quarter",
  "month",
  "week",
  "day",
  "hour",
  "minute",
  "second",
];

function* relativeTimeFormatOptions() {
  const styleOptions = ["long", "short", "narrow"];
  const numericOptions = ["always", "auto"];
  for (const locale of LOCALES) {
    for (const style of styleOptions) {
      for (const numeric of numericOptions) {
        yield { locale, style, numeric };
      }
    }
  }
}



function runTest() {
  let lastResult;
  let totalLength = 0;
  const RELATIVE_TIME_FORMAT_COUNT = 100;
  let unitIndex = 0;
  for (const { locale, style, numeric } of shuffleOptions(
    relativeTimeFormatOptions
  )) {
    const formatter = new Intl.RelativeTimeFormat(locale, { style, numeric });
    for (let i = 0; i < RELATIVE_TIME_FORMAT_COUNT; i++) {
      const unit = UNITS[unitIndex % UNITS.length];
      unitIndex++;
      const value = Math.random() * 100 - 50;
      lastResult = formatter.format(value, unit);
      totalLength += lastResult.length;
      const formatPartsResult = formatter.formatToParts(value, unit);
      for (const part of formatPartsResult) {
        totalLength += part.value.length;
      }
    }
  }
  return { lastResult, totalLength, expectedLength: 434328 };
}
