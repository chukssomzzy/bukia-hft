#!/usr/bin/env node
const { copyEjsFiles } = require("./copy-ejs-to-build");

function main() {
  copyEjsFiles();
}

try {
  main();
} catch (err) {
  process.exit(1);
}
