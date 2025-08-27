function* pluralRulesOptions() {
  const typeOptions = ["cardinal", "ordinal"];
  for (const locale of LOCALES) {
    for (const type of typeOptions) {
      yield { locale, type };
    }
  }
}

function runTest() {
  let lastResult;
  let totalLength = 0;
  const PLURAL_RULES_COUNT = 1000;
  for (const { locale, type } of shuffleOptions(pluralRulesOptions)) {
    const formatter = new Intl.PluralRules(locale, { type });
    let i = 0;
    for (let value = 0; value < 4; value++) {
      lastResult = formatter.select(value);
      totalLength += lastResult.length;
      i++;
    }
    for (; i < PLURAL_RULES_COUNT; i++) {
      const value = Math.floor(Math.random() * 1000);
      lastResult = formatter.select(value);
      totalLength += lastResult.length;
    }
  }
  return { lastResult, totalLength, expectedLength: 244941 };
}
