onst path = require('path');
const fs = require('fs');
const { scrapeMeetupSearch } = require('./extractors/meetup_parser');
const { exportDataset } = require('./outputs/dataset_exporter');

function loadJsonSafe(filePath) {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return null;
    }
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[config] Failed to read or parse JSON at ${filePath}:`, err.message);
    return null;
  }
}

function loadConfig() {