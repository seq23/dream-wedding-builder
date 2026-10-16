"""Strictly parse an RSS feed from stdin and print its items as JSON.

Used by tests/unit/pinfeed.test.ts and scripts/validators/validate_pinterest.mjs so
"the feed parses" means a real XML parser accepted it, not a regex. Exits non-zero
on malformed XML or a non-RSS-2.0 root.
"""
import json
import sys
import xml.etree.ElementTree as ET

MEDIA = '{http://search.yahoo.com/mrss/}content'
root = ET.fromstring(sys.stdin.buffer.read())
if root.tag != 'rss' or root.get('version') != '2.0':
    sys.exit(f'root is <{root.tag} version={root.get("version")}>, expected <rss version="2.0">')
channel = root.find('channel')
if channel is None:
    sys.exit('no <channel>')
items = []
for item in channel.findall('item'):
    enclosure = item.find('enclosure')
    media = item.find(MEDIA)
    items.append({
        'title': item.findtext('title'),
        'link': item.findtext('link'),
        'description': item.findtext('description'),
        'pubDate': item.findtext('pubDate'),
        'enclosure': dict(enclosure.attrib) if enclosure is not None else None,
        'media': dict(media.attrib) if media is not None else None,
    })
print(json.dumps({'channel_link': channel.findtext('link'), 'items': items}))
