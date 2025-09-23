function shuffleOptions(optionsGenerator) {
  const options = Array.from(optionsGenerator());
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

const LOCALES = [
  "ar-SA",
  "zh-CN",
  "zh-TW",
  "da-DK",
  "en-US",
  "en-GB",
  "en-CA",
  "en-AU",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "hi-IN",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "pt-BR",
  "pt-PT",
  "ru-RU",
  "es-ES",
  "es-MX",
  "sw-KE",
  "sv-SE",
  "th-TH",
  "tr-TR",
  "vi-VN",
];

globalThis.console ??= {};
console.log ??= (...args) => print(...args);
