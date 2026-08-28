import type { ProductFacets } from '@forge-kivu/api-client'

export type AttributeFacet = ProductFacets['attributes'][number]

export const SURFACED_ATTRIBUTE_LIMIT = 4

export const attributeTitle = (attribute: AttributeFacet): string =>
  attribute.unit ? `${attribute.name} (${attribute.unit})` : attribute.name

const coverage = (attribute: AttributeFacet): number =>
  attribute.values.reduce((total, value) => total + value.count, 0)

const topCount = (attribute: AttributeFacet): number =>
  attribute.values.reduce((top, value) => Math.max(top, value.count), 0)

export const splitAttributes = (
  attributes: AttributeFacet[],
  filteredSlugs: string[],
): { surfaced: AttributeFacet[]; rest: AttributeFacet[] } => {
  const ranked = attributes
    .filter((attribute) => topCount(attribute) > 1)
    .sort(
      (a, b) =>
        topCount(b) - topCount(a) ||
        coverage(b) - coverage(a) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, SURFACED_ATTRIBUTE_LIMIT)

  const chosen = new Set([
    ...ranked.map((attribute) => attribute.slug),
    ...filteredSlugs,
  ])

  return {
    surfaced: attributes.filter((attribute) => chosen.has(attribute.slug)),
    rest: attributes.filter((attribute) => !chosen.has(attribute.slug)),
  }
}
