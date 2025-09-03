const LISTS = [
  ["One"],
  ["1", "2"],
  ["Motorcycle", "Bus", "Car"],
  LOCALES,
  new Array(100).fill(9).map((_, index) => index.toString()),
];

function* listOptions() {
  const styleOptions = ["long", "short", "narrow"];
  const typeOptions = ["conjunction", "disjunction", "unit"];
  for (const locale of LOCALES) {
    for (const style of styleOptions) {
      for (const type of typeOptions) {
        yield { locale, style, type };
      }
    }
  }
}

function runTest(verbose = false) {
  let lastResult;
  let totalLength = 0;
  const LIST_FORMAT_COUNT = 10;
  let listIndex = 0;
  for (const { locale, style, type } of shuffleOptions(listOptions)) {
    const options = { style, type };
    if (verbose) {
      console.log(locale, JSON.stringify(options));
    }
    const formatter = new Intl.ListFormat(locale, options);
    for (let i = 0; i < LIST_FORMAT_COUNT; i++) {
      const list = LISTS[listIndex % LISTS.length];
      listIndex++;
      lastResult = formatter.format(list);
      totalLength += lastResult.length;
      const formatPartsResult = formatter.formatToParts(list);
      if (verbose) {
        console.log(value, lastResult);
      }
      for (const part of formatPartsResult) {
        totalLength += part.value.length;
      }
    }
  }
  return { lastResult, totalLength, expectedMinLength: 506_000 };
}
