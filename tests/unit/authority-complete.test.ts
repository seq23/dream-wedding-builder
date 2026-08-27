import { describe, expect, it } from 'vitest';

import registry from '@/data/authority/content_registry.json';
import { findPlaceholders, isComplete, missingRequiredFields } from '@/lib/authority-complete.mjs';
import { isComplete as reExported, shippingPages } from '@/lib/authority-registry';

// The registry gained 45 entries in 28 days that no route would serve, because the
// generator that wrote them and the route that refused them applied different rules.
// These tests pin the rule to one function object and check the committed data
// against it, so a record that cannot render cannot arrive unnoticed again.

const completeRecord = {
  slug: 'example',
  sections: [],
  faqs: [],
  related_slugs: [],
  examples: [],
  hub_route: '/wedding-checklist',
};

describe('isComplete is one predicate', () => {
  it('is the same function object the app imports from lib/authority-registry', () => {
    expect(reExported).toBe(isComplete);
  });

  it('accepts a record carrying all five fields the guide template dereferences', () => {
    expect(isComplete(completeRecord)).toBe(true);
    expect(missingRequiredFields(completeRecord)).toEqual([]);
  });

  it.each(['sections', 'faqs', 'related_slugs', 'examples', 'hub_route'])(
    'rejects a record with no %s',
    (field) => {
      const record: Record<string, unknown> = { ...completeRecord };
      delete record[field];
      expect(isComplete(record)).toBe(false);
      expect(missingRequiredFields(record)).toContain(field);
    },
  );

  it('rejects the ten-field shape publish_authority_batch.mjs used to write', () => {
    const skeleton = {
      slug: 's', title: 't', cluster: 'c', product_id: 'operations-suite',
      semantic_key: 'wedding planning|how to plan {topic}|engaged couples',
      source_opportunity_id: 'x', summary: 's', answer: 'a', steps: [], mistakes: [],
    };
    expect(isComplete(skeleton)).toBe(false);
    expect(missingRequiredFields(skeleton)).toEqual(['sections', 'faqs', 'related_slugs', 'examples', 'hub_route']);
  });
});

describe('unexpanded template placeholders', () => {
  it('finds a {placeholder} anywhere in a record and reports where', () => {
    const hits = findPlaceholders({ semantic_key: 'wedding planning|how to plan {topic}|engaged couples' });
    expect(hits).toEqual([{ path: '.semantic_key', value: 'wedding planning|how to plan {topic}|engaged couples' }]);
  });

  it('looks inside arrays and nested objects', () => {
    expect(findPlaceholders({ sections: [{ heading: 'Plan {topic}' }] })).toEqual([
      { path: '.sections[0].heading', value: 'Plan {topic}' },
    ]);
  });

  it('does not fire on ordinary copy', () => {
    expect(findPlaceholders(completeRecord)).toEqual([]);
  });
});

describe('the committed registry', () => {
  it('contains only records the router will serve', () => {
    const unrenderable = registry.pages.filter((page) => !isComplete(page)).map((page) => page.slug);
    expect(unrenderable).toEqual([]);
    expect(shippingPages.length).toBe(registry.pages.length);
  });

  it('contains no unexpanded template placeholder', () => {
    expect(findPlaceholders(registry.pages)).toEqual([]);
  });
});
