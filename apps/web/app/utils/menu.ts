import type { CategoryNode } from '@forge-kivu/api-client'

export type MenuItem = {
  id: string
  label: string
  target: string
  children?: MenuItem[]
}

export const categoryMenuItems = (nodes: CategoryNode[]): MenuItem[] =>
  nodes.map((node) => ({
    id: node.id,
    label: node.name,
    target: `/?category=${encodeURIComponent(node.slug)}`,
    children: categoryMenuItems(node.children),
  }))

export const menuColumns = (
  items: MenuItem[],
  selection: string[],
): MenuItem[][] => {
  const columns: MenuItem[][] = []
  let level = items
  for (let depth = 0; level.length; depth++) {
    columns.push(level)
    level = level.find((item) => item.id === selection[depth])?.children ?? []
  }
  return columns
}
