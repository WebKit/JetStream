function generateRandomDates(count) {
  const firstDate = new Date(1800, 11, 5, 13, 6);
  let currentTimeStamp = firstDate.getTime();
  const dates = [];

  for (let i = 0; i < count; i++) {
    dates.push(new Date(currentTimeStamp));
    currentTimeStamp += 1234569;
  }
  return dates;
}

const DATE_STYLE_OPTIONS = ["full", "long", "medium", "short"];
const TIME_STYLE_OPTIONS = ["full", "long", "medium", "short"];

function* dateTimeFormatOptions() {
  for (const locale of LOCALES) {
    for (const dateStyle of DATE_STYLE_OPTIONS) {
      for (const timeStyle of TIME_STYLE_OPTIONS) {
        yield { locale, dateStyle, timeStyle };
      }
    }
  }
}

function runTest() {
  let totalLength = 0;
  let lastFormatResult;
  let lastFormatPartResult;
  let lastFormatRangeResult;
  const dates = generateRandomDates(100);
  let dateIndex = 0;

  const FORMAT_COUNT = 17;
  const FORMAT_RANGE_COUNT = 7;
  for (const { locale, dateStyle, timeStyle } of shuffleOptions(
    dateTimeFormatOptions
  )) {
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle, timeStyle });
    for (let i = 0; i < FORMAT_COUNT; i++) {
      let date = dates[dateIndex % dates.length];
      lastFormatResult = formatter.format(date);
      totalLength += lastFormatResult.length;
      dateIndex++;

      date = dates[dateIndex % dates.length];
      lastFormatPartResult = formatter.formatToParts(date);
      for (const part of lastFormatPartResult) {
        totalLength += part.value.length;
      }
      dateIndex++;
    }
    let dateRangeStart = dates[0];
    for (let i = 0; i < FORMAT_RANGE_COUNT; i++) {
      const date = dates[dateIndex % dates.length];
      if (dateRangeStart < date)
        lastFormatRangeResult = formatter.formatRange(dateRangeStart, date);
      dateRangeStart = date;
    }
  }
  return {
    lastResult: lastFormatResult + lastFormatRangeResult,
    totalLength,
    expectedLength: 442105,
  };
}
