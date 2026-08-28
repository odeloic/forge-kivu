# Catalogue Facets Spec

Feeds the public product filter sidebar (`ProductFilters.vue`). Companion to the catalogue module spec — the products list and its filters already exist; this adds the endpoint that tells the UI *what* can be filtered.

## Decisions

1. **Postgres computes the facets — no search engine.** Same database, same transaction-consistent view as the product list; no sync pipeline to operate. ~~At this catalogue size the grouped queries are sub-millisecond with an index on `product_specs (attribute_id, value)`. Reconsider only when full-text search with typo tolerance and ranking becomes a requirement; the endpoint contract stays the same either way, so Typesense later is a swap, not a rewrite~~ (Irrelevant information).
2. **One public endpoint: `GET /catalogue/products/facets`.** It accepts exactly the same query params as `GET /catalogue/products` (~~`category`, `supplier`, `spec.<slug>=<value>`~~ `category`, `supplier`, `priceMin`, `priceMax`, `spec.<slug>=<value>`) and reuses the same condition-building logic (published status, visible suppliers, category subtree, spec EXISTS). One source of truth for what "matches" means.
3. **Facets are scoped to the current filters.** The sidebar refines as the user filters: value lists and counts reflect the remaining result set, not the whole catalogue. Consequence, accepted: attribute sections vanish entirely when no remaining product carries them.
4. **All spec attributes are facet dimensions.** No curation flag on `spec_attributes` — every attribute with at least one value on a matching published product becomes a sidebar section. If the list grows noisy, a `filterable` flag on the attribute is the later fix.
5. **Suppliers are a facet dimension too** — rendered as "Brand" in the UI. Uses the existing `?supplier=<slug>` param, so it needs no new filter mechanics, only its value list and counts in the response.
6. **Counts use the exclude-own-dimension rule.** Each dimension's counts are computed with every active filter applied *except its own*. This keeps sibling values visible and correctly counted once a value is selected (checking "Wood" must not zero out "Steel"). Values with zero matches are omitted.
7. **Price bounds come from `product_variants.price`** — min and max across matching products (scoped like everything else, excluding any future price filter's own value). Null when no matching variant has a price. The hardcoded 5,000–500,000 in the sidebar dies.
8. ~~**Availability stays out.** Nothing in the schema models stock; the section remains decorative until an availability model exists.~~ **Availability is deleted from the sidebar.** Nothing in the schema models stock, and a control that cannot filter is worse than an absent one. It returns when a stock model does.
9. ~~**Single value per attribute for now.** The existing `spec.<slug>=<value>` contract is one value per attribute; multi-select within a section (OR semantics, repeated params) is deferred and purely additive.~~ **Multi-select within a section.** `spec.<slug>` accepts repeated params; values within an attribute combine with OR, attributes still combine with AND. Pulled forward once the sidebar became interactive: checkboxes that replace the previous selection instead of combining with it read as broken.
10. **Categories are a facet dimension too.** `?category=<slug>` always filtered — it matches the whole subtree — but the response carried no counts, so the sidebar could not show the dimension usefully and `ProductFilters.vue` omitted it entirely. `getFacets` returns `categories`: one entry per **root** category, counting every matching product in its subtree, in tree order rather than by count. Tree order because a taxonomy read as navigation should not reshuffle as the result set narrows. Drilling into a child is a later, additive change.
11. **Price is filterable: `?priceMin=` and `?priceMax=`.** Both optional, non-negative integers, either usable alone. A product matches when **one variant** falls inside the range — not when its cheapest does — so a product spanning the boundary is found by the range containing any of its prices. Decision 7's parenthetical arrives: the facet bounds are computed with the price dimension omitted, so the slider's track does not collapse onto its own handles the moment it is dragged.

## Response shape

```jsonc
{
  "price": { "min": 5000, "max": 395000 },        // null when no priced variant matches
  "categories": [
    { "slug": "furniture-joinery", "name": "Furniture & Joinery", "count": 4 }
  ],
  "suppliers": [
    { "slug": "kivu-home-interiors", "name": "Kivu Home & Interiors", "count": 8 }
  ],
  "attributes": [
    {
      "slug": "material",
      "name": "Material",
      "unit": null,
      "values": [
        { "value": "Wood", "count": 12 },
        { "value": "Steel", "count": 5 }
      ]
    }
  ]
}
```

Ordering: suppliers and values by count descending, then alphabetically; attributes alphabetically; categories in tree order.

An unresolvable `?category=` slug empties every dimension, including the category dimension itself — omitting a dimension for the exclude-own rule must not rescue a filter value that does not exist.

## Query plan sketch

Per request, sharing the list endpoint's `conditions` builder:

- one grouped query per dimension family — `product_specs` joined to `spec_attributes` grouped by `(slug, name, unit, value)`, suppliers grouped by `(slug, name)`, products grouped by `category_id` and rolled up to their root in memory, and a min/max over `product_variants.price` — each with the own-dimension filter dropped;
- all run in parallel; no N+1 per attribute.


## Vertical slices

Not a separate module — a read endpoint over catalogue tables, so it lives in `catalogue` (service function + route + schema). Each slice ships and is validated before the next starts.

1. **Unscoped attribute facets.** `GET /catalogue/products/facets` returns `attributes` only, whole catalogue, ignoring query params. Validate: curl matches a hand-run SQL count against seed data.
2. **Suppliers + price bounds.** Add the `suppliers` and `price` fields, still unscoped. Validate: counts sum to published product totals; bounds match min/max of seeded variant prices.
3. **Scoping.** Parse the list query params, apply shared conditions with the exclude-own-dimension rule. Validate: `?supplier=X` keeps all suppliers listed but rescopes attribute counts; `?spec.material=Wood` keeps Steel visible with its count.
4. **Sidebar renders facets.** `ProductFilters` fetches the endpoint (SSR) and renders sections from it; hardcoded arrays deleted; controls not yet interactive. Validate: sidebar sections mirror the curl output.
5. **Filter state in the URL.** Checking a value updates the query on `/`; list and facets both refetch from it. Validate: filtered SSR page load renders the refined list and counts directly.

## ~~Veto if wrong~~ Decided

1. Endpoint path `GET /catalogue/products/facets`
2. Response field names `price` / `suppliers` / `attributes` and count-descending ordering.
3. Zero-count values omitted rather than shown disabled.
4. Attributes with no matching values omitted rather than shown empty.
5. ~~Color hexes mapped client-side by value name, not stored in the database.~~ Dropped. Colour is a product *option*, not a spec attribute, so it never appears in `attributes` and the swatch code could never match a facet. Options become facet dimensions, or colour becomes a spec attribute — until then there are no swatches.
6. Facets and product list are two requests, not one combined response.
7. The category dimension counts roots only, in tree order.
8. A price range matches on any one variant, not on `priceFrom`.
9. An unresolvable `category` slug empties every dimension rather than only the product list.
