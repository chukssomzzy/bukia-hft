const fs = require("fs");
const path = require("path");

// Copy EJS templates from src/views into build/views preserving directory structure
function findEjsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findEjsFiles(filePath, fileList);
    } else if (path.extname(file) === ".ejs") {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function copyEjsFiles() {
  const srcDir = path.join(__dirname, "..", "src", "views");
  if (!fs.existsSync(srcDir)) {
    console.log(`No views directory found at ${srcDir}, skipping EJS copy.`);
    return;
  }

  const ejsFiles = findEjsFiles(srcDir);
  ejsFiles.forEach((file) => {
    const relativePath = path.relative(srcDir, file);
    const destPath = path.join(__dirname, "..", "build", "views", relativePath);
    const destDir = path.dirname(destPath);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(file, destPath);
    console.log(`Copied: ${file} -> ${destPath}`);
  });
  console.log("EJS templates copied to build/views");
}

module.exports = { copyEjsFiles };
