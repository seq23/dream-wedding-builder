/** The same ordered entries feed the visible cards and their collection markup. */
export function itemListSchema(url: string, name: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${url}#items`,
    url,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.name, url: item.url
    }))
  };
}
