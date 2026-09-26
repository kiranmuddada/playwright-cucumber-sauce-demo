module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['ts-node/register/transpile-only'],
    require: ['src/support/**/*.ts', 'src/step_definitions/**/*.ts'],
    format: [
      'progress-bar',
      'json:reports/cucumber-report.json',
      'html:reports/cucumber-report.html'
    ],
    formatOptions: { snippetInterface: 'async-await' },
    parallel: 1,
    retry: 0
  }
};
