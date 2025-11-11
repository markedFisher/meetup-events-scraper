onst fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function ensureDirSync(dirPath) {
const resolved = path.resolve(dirPath);
if (!fs.existsSync(resolved)) {
fs.mkdirSync(resolved, { recursive: true });
}
}

function flattenEvent(event) {
const group = event.group || {};
const venue = event.venue || {};
const rsvps = event.rsvps || {};
const featuredEventPhoto = event.featuredEventPhoto || {};

return {
id: event.id || '',
title: event.title || '',
description: event.description || '',
dateTime: event.dateTime || '',
eventType: event.eventType || '',
eventUrl: event.eventUrl || '',
featuredEventPhotoHighResUrl: featuredEventPhoto.highResUrl || '',
groupName: group.name || '',
groupUrlname: group.urlname || '',
venueName: venue.name || '',
venueLat: venue.lat != null ? venue.lat : '',
venueLng: venue.lng != null ? venue.lng : '',
rsvpsTotalCount: typeof rsvps.totalCount === 'number' ? rsvps.totalCount : '',
searchUrl: event.searchUrl || ''
};
}

function exportJson(events, outputPath) {
const payload = JSON.stringify(events, null, 2);
fs.writeFileSync(outputPath, payload, 'utf8');
console.log(`[export] JSON written to ${outputPath}`);
}

function exportCsv(events, outputPath) {
const rows = events.map(flattenEvent);
if (!rows.length) {
fs.writeFileSync(outputPath, '', 'utf8');
console.log(`[export] Empty CSV written to ${outputPath}`);
return;
}

const headers = Object.keys(rows[0]);
const lines = [];

lines.push(headers.join(','));

for (const row of rows) {
const values = headers.map((key) => {
let value = row[key];
if (value === null || value === undefined) value = '';
value = String(value);
// Escape CSV values
if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
value = `"${value.replace(/"/g, '""')}"`;
}
return value;
});
lines.push(values.join(','));
}

fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`[export] CSV written to ${outputPath}`);
}

function exportExcel(events, outputPath) {
const rows = events.map(flattenEvent);
const worksheet = XLSX.utils.json_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');
XLSX.writeFile(workbook, outputPath);
console.log(`[export] Excel workbook written to ${outputPath}`);
}

function exportHtml(events, outputPath) {
const rows = events.map(flattenEvent);
if (!rows.length) {
fs.writeFileSync(outputPath, '<html><body><p>No events available.</p></body></html>', 'utf8');
console.log(`[export] HTML written to ${outputPath}`);
return;
}

const headers = Object.keys(rows[0]);

const headRow = headers.map((h) => `<th>${h}</th>`).join('');
const bodyRows = rows
.map((row) => {
const cells = headers.map((key) => `<td>${row[key] != null ? String(row[key]) : ''}</td>`).join('');
return `<tr>${cells}</tr>`;
})
.join('\n');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Meetup Events Export</title>
<style>
body { font-family: Arial, sans-serif; font-size: 14px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
th { background-color: #f4f4f4; }
tr:nth-child(even) { background-color: #fafafa; }
</style>
</head>
<body>
<h1>Meetup Events Export</h1>
<table>
<thead>
<tr>${headRow}</tr>
</thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`[export] HTML written to ${outputPath}`);
}

function exportXml(events, outputPath) {
const rows = events.map(flattenEvent);
const escapeXml = (value) =>
String(value)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&apos;');

const itemsXml = rows
.map((row) => {
const fieldsXml = Object.entries(row)
.map(([key, value]) => `<${key}>${value != null ? escapeXml(value) : ''}</${key}>`)
.join('');
return `<event>${fieldsXml}</event>`;
})
.join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<events>
${itemsXml}
</events>`;

fs.writeFileSync(outputPath, xml, 'utf8');
console.log(`[export] XML written to ${outputPath}`);
}

/**
* Export dataset in requested formats.
* @param {Array<object>} events
* @param {object} exportConfig
*/
async function exportDataset(events, exportConfig = {}) {
const outputDir = exportConfig.outputDir || path.join(__dirname, '..', '..', 'data');
const baseFileName = exportConfig.baseFileName || 'meetup_events';
const formats = Array.isArray(exportConfig.formats) && exportConfig.formats.length ? exportConfig.formats : ['json'];

ensureDirSync(outputDir);

for (const fmt of formats) {
const format = fmt.toLowerCase();
const filePath = path.join(outputDir, `${baseFileName}.${format}`);

try {
switch (format) {
case 'json':
exportJson(events, filePath);
break;
case 'csv':
exportCsv(events, filePath);
break;
case 'xlsx':
case 'excel':
exportExcel(events, filePath);
break;
case 'html':
exportHtml(events, filePath);
break;
case 'xml':
exportXml(events, filePath);
break;
default:
console.warn(`[export] Unknown export format "${fmt}" - skipping.`);
}
} catch (err) {
console.error(`[export] Failed to write format "${fmt}" to ${filePath}:`, err.message);
}
}
}

module.exports = {
exportDataset
};