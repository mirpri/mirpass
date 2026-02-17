module.exports = {
  input: ["src/**/*.{ts,tsx}"],

  output: "./",

  options: {
    debug: false,
    removeUnusedKeys: false,
    sort: true,

    lngs: ["en", "zh"],
    defaultLng: "en",

    resource: {
      loadPath: "src/i18n/locales/{{lng}}.json",
      savePath: "src/i18n/locales/{{lng}}.json",
    },

    keySeparator: ".",
    nsSeparator: ":",

    interpolation: {
      prefix: "{{",
      suffix: "}}",
    },
  },
};
