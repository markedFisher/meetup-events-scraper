onst axios = require('axios');
const cheerio = require('cheerio');
const { toIsoString, fromLocalDateAndTime } = require('./utils_date');

/**
* Attempt to identify and extract event-like objects from a deeply nested JSON tree.
* This is intentionally defensive: if Meetup changes its structure, we still do a best-effort scan.
*/
function collectEventNodes(root) {
const results = [];

function visit(node) {
if (!node || typeof node !== 'object') return;

if (Array.isArray(node)) {
for (const item of node) {
visit(item);
}
return;
}

// Node looks like an event itself
const looksLikeEvent =
(node.id && (node.title || node.name) && (node.eventUrl || node.link || node.url)) ||
(node.event && typeof node.event === 'object' && (node.event.title || node.event.name));

if (looksLikeEvent) {
results.push(node);
}

// Node contains an "event" property wrapping the actual event
if (node.event && typeof node.event === 'object') {
results.push(node.event);
}

for (const value of Object.values(node)) {
visit(value);
}
}

visit(root);
return results;
}

function normalizeEvent(raw, searchUrl) {
const base = raw.event && typeof raw.event === 'object' ? raw.event : raw;

const id =
base.id ||
base._id ||
(typeof base.key === 'string' ? base.key : undefined) ||
(base.slug ? String(base.slug) : undefined);

const title = base.title || base.name || base.eventTitle || '';

const description =
base.description ||
(base.shortDescription ? String(base.shortDescription) : '') ||
(base.plain_text_no_images ? String(base.plain_text_no_images) : '');

// Determine raw date/time fields
let rawDateTime =
base.dateTime ||
base.dateTimeLocal ||
base.local_date ||
base.time ||
base.startTime ||
base.date ||
base.scheduled_time;

let localDate = base.local_date || base.date;
let localTime = base.local_time || base.time;

let dateTime;
if (localDate && localTime) {
dateTime = fromLocalDateAndTime(localDate, localTime);
} else {
dateTime = toIsoString(rawDateTime);
}

// Event type / online vs in-person
let eventType = base.eventType || base.event_type || '';
if (!eventType) {
if (base.isOnline || base.onlineEvent || base.is_online_event) {
eventType = 'ONLINE';
} else {
eventType = 'IN_PERSON';
}
}

// Event URL
const eventUrl =
base.eventUrl ||
base.link ||
base.url ||
(base.shortUrl ? base.shortUrl : undefined) ||
(base.slug ? `https://www.meetup.com/${base.slug}` : undefined);

// Featured photo
let highResUrl;
if (base.featuredEventPhoto && base.featuredEventPhoto.highResUrl) {
highResUrl = base.featuredEventPhoto.highResUrl;
} else if (base.photoUrl) {
highResUrl = base.photoUrl;
} else if (base.featured_photo && base.featured_photo.photo_link) {
highResUrl = base.featured_photo.photo_link;
}

const groupData = base.group || raw.group || {};
const venueData = base.venue || raw.venue || {};

const group = {
name: groupData.name || groupData.title || '',
urlname: groupData.urlname || groupData.slug || ''
};

const venue = {
name: venueData.name || venueData.venue || venueData.address_1 || 'Online event',
lat: venueData.lat || venueData.latitude || null,
lng: venueData.lng || venueData.longitude || null
};

const rsvpsRaw = base.rsvps || base.yes_rsvp_count || base.attendees || base.going;
let totalCount = 0;
if (typeof rsvpsRaw === 'number') {
totalCount = rsvpsRaw;
} else if (rsvpsRaw && typeof rsvpsRaw === 'object' && typeof rsvpsRaw.totalCount === 'number') {
totalCount = rsvpsRaw.totalCount;
}

return {
id: id ? String(id) : undefined,
title,
description,
dateTime,
eventType: String(eventType).toUpperCase(),
eventUrl,
featuredEventPhoto: highResUrl ? { highResUrl } : undefined,
group,
venue,
rsvps: { totalCount },
searchUrl
};
}

/**
* Fetch a Meetup search URL and extract normalized event objects.
* @param {string} searchUrl
* @param {object} options
* @returns {Promise<Array<object>>}
*/
async function scrapeMeetupSearch(searchUrl, options = {}) {
const { maxItems = 200, eventType = 'ALL' } = options;

let response;
try {
response = await axios.get(searchUrl, {
headers: {
'User-Agent':
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
},
timeout: 30000
});
} catch (err) {
console.error(`[parser] HTTP request failed for ${searchUrl}:`, err.message);
throw err;
}

const html = response.data;
const $ = cheerio.load(html);

let rawJson = $('#__NEXT_DATA__').html();

if (!rawJson) {
$('script[type="application/json"]').each((_, el) => {
const content = $(el).html();
if (content && content.includes('"props"') && content.includes('"pageProps"')) {
rawJson = content;
}
});
}

if (!rawJson) {
console.warn('[parser] Could not locate embedded JSON data on the page. Returning empty result set.');
return [];
}

let data;
try {
data = JSON.parse(rawJson);
} catch (err) {
console.error('[parser] Failed to parse embedded JSON data:', err.message);
return [];
}

const candidateEvents = collectEventNodes(data);
if (!candidateEvents.length) {
console.warn('[parser] No event-like nodes found in embedded JSON. Returning empty result set.');
return [];
}

const normalized = candidateEvents.map((node) => normalizeEvent(node, searchUrl));

const filtered = normalized.filter((ev) => {
if (!ev.eventUrl && !ev.title) {
return false;
}
if (eventType && eventType.toUpperCase() !== 'ALL') {
return ev.eventType === eventType.toUpperCase();
}
return true;
});

if (filtered.length > maxItems) {
return filtered.slice(0, maxItems);
}

return filtered;
}

module.exports = {
scrapeMeetupSearch
};