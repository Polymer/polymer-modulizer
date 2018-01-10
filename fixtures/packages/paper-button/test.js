const path = require('path');

module.exports = {
  options: ['--npm-name', '@polymer/paper-button', '--npm-version', '3.0.0'],
  stdout: `[1/2] 🌀  Converting Package...
Out directory: ${path.join(__dirname, 'generated')}
[2/2] 🎉  Conversion Complete!`,
  stderr: `WARN: bower->npm mapping for "marked" not found
WARN: bower->npm mapping for "prism" not found
Issue in bower_components/prism-element/prism-import.html: document.currentScript is always \`null\` in an ES6 module.`,
};
