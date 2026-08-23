export const useProductFacets = () => {
  const api = useApi()
  const { query } = useCatalogueFilters()

  return useAsyncData(
    'product-facets',
    async () => {
      const res = await api.catalogue.products.facets.$get({
        query: query.value,
      })
      if (!res.ok) return null
      return res.json()
    },
    { watch: [query] },
  )
}
