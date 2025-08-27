const CURRENCIES = ["USD", "EUR", "JPY", "INR", "NGN"];

const NUMBER_UNITS = [
  "acre",
  "bit",
  "byte",
  "celsius",
  "centimeter",
  "day",
  "degree",
  "fahrenheit",
  "fluid-ounce",
  "foot",
  "gallon",
  "gigabit",
  "gigabyte",
  "gram",
  "hectare",
  "hour",
  "inch",
  "kilobit",
  "kilobyte",
  "kilogram",
  "kilometer",
  "liter",
  "megabit",
  "megabyte",
  "meter",
  "microsecond",
  "mile",
  "mile-scandinavian",
  "milliliter",
  "millimeter",
  "millisecond",
  "minute",
  "month",
  "nanosecond",
  "ounce",
  "percent",
  "petabyte",
  "pound",
  "second",
  "stone",
  "terabit",
  "terabyte",
  "week",
  "yard",
  "year",
];

function* numberFormatOptions() {
  const currencyDisplayOptions = ["symbol", "narrowSymbol", "code", "name"];
  const unitDisplayOptions = ["short", "long", "narrow"];

  for (const locale of LOCALES) {
    for (const currency of CURRENCIES) {
      for (const currencyDisplay of currencyDisplayOptions) {
        yield { locale, style: "currency", currency, currencyDisplay };
      }
    }
    for (const unit of NUMBER_UNITS.slice(0, 20)) {
      for (const unitDisplay of unitDisplayOptions) {
        yield { locale, style: "unit", unit, unitDisplay };
      }
    }
    yield { locale, style: "decimal" };
    yield { locale, style: "percent" };
  }
}

function runTest() {
  let lastResult;
  let totalLength = 0;
  const NUMBER_FORMAT_COUNT = 10;
  let counter = 1;
  for (const options of shuffleOptions(numberFormatOptions).slice(0, 200)) {
    const formatter = new Intl.NumberFormat(options.locale, options);
    for (let i = 0; i < NUMBER_FORMAT_COUNT; i++) {
      counter += 599;
      const value = counter % 10_000;
      lastResult = formatter.format(value);
      totalLength += lastResult.length;
      const formatPartsResult = formatter.formatToParts(value);
      for (const part of formatPartsResult) {
        totalLength += part.value.length;
      }
    }
  }
  return { lastResult, totalLength, expectedLength: 40988 };
}
