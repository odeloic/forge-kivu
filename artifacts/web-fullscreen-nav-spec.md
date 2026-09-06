# Web Fullscreen Nav Spec

Header and fullscreen menu for `apps/web` public pages (the `default` layout).
Workshop and admin layouts keep their current `AppNav`. Design canvas:
https://claude.ai/code/artifact/f5190fa1-72ed-42bd-a387-96570af9e72b, source in
`artifacts/design/web-fullscreen-nav/`.

## Decisions

1. **The header is a wordmark on the left and one hamburger button on the right.**
   No inline links. Every destination lives in the menu, so the header is the same
   on every public page and never wraps.
2. **The menu is a fullscreen overlay under the header, not a dropdown.** It drops
   from under the header rule (420ms) and covers the page; the header stays visible
   and the hamburger becomes a close icon. The page underneath does not scroll
   while it is open.
3. **A left spine lists the four public sections: Products, Spaces, Brands, Suppliers.**
   Home, Contact, Workshop and Admin are not sections. Home is the wordmark,
   Contact sits in the utility strip, Workshop and Admin belong to the session
   area, not the public menu.
4. **Sections drill right, one 360px column per level.** Picking a spine item
   reveals a column of its entries; picking an entry that has children reveals the
   next column. A column exists only when it has content, and animates from 0 to
   360px (360ms). No empty placeholder columns.
5. **Every column is full height and its list starts at the top.** Spine items are
   vertically centered in equal cells. Level columns never center or bottom-align
   their lists, so a column's first item is always at the same y regardless of depth.
6. **Long lists scroll inside their column behind a bottom fade.** They do not spill
   into a second column, so the column count always equals the depth. Spaces (19
   entries) is the case that needs it.
7. **Picking a leaf navigates and closes the menu.** Picking a branch only expands.
   Picking a different spine item collapses every deeper column.
8. **Menu data comes from three existing endpoints, fetched once when the menu first
   opens.** `GET /categories` (tree) for Products, `GET /spaces` for Spaces,
   `GET /suppliers` for Suppliers. Brands has no endpoint and reveals nothing until
   one exists. Deferred: Brands column, needs a brands module.
9. **No search and no sign-up in the menu.** Neither exists in the app. The utility
   strip is Log in and Contact only; Log in becomes the user's email plus Log out
   when a session exists, reusing what `AppSession` shows today.
10. **The overlay is a reka-ui `DialogRoot`, like `UiDialog`.** It gives focus trap,
    Escape to close and body scroll lock without new code. Restyled, not reused:
    `UiDialog` is a centered card.
11. **Visual values come from `packages/ui` tokens, with three menu-only sizes.**
    Spine labels 1.75rem semibold, level labels 0.9375rem with 0.04em tracking,
    rows 56px. These are not tokens yet; promote them if a second surface uses them.
12. **`PRIMARY_NAV` keeps its shape and the access filter keeps working.** Sections
    are still `{ path, label }` entries filtered through `resolveAccess`/`canAccess`
    (web-routing-spec.md, decision 5). The menu adds a `children` loader per path,
    it does not replace the entry type.

## Component layout

```
apps/web/app/
  components/
    AppHeader.vue          wordmark + hamburger, owns `open` state, mounts AppMenu
    AppMenu.vue            DialogRoot overlay: spine, columns, utility strip
    AppMenuColumn.vue      one level column: list, active item, scroll + fade
  composables/
    useMenuTree.ts         lazy loaders per section, cached for the session
  utils/
    navigation.ts          PRIMARY_NAV trimmed to the four sections + section loaders
  layouts/default.vue      <AppHeader /> replaces <AppNav /> + <AppSession />
```

## Behavior

| Action | Result |
| --- | --- |
| Click hamburger | overlay drops in, icon becomes X, focus moves to first spine item |
| Click X, press Escape, click wordmark | overlay closes, focus returns to hamburger |
| Route change | overlay closes |
| Click spine item with entries | its column expands from the spine; deeper columns collapse; item turns ink, others muted |
| Click spine item without entries (Brands) | item turns ink, nothing expands |
| Click branch entry | next column expands; entry turns ink and semibold |
| Click leaf entry | `navigateTo(target)`, overlay closes |
| Reopen after navigating | spine item for the current route is preselected and its column is out |
| Arrow Up/Down inside a column | move focus within the column; Right enters the next column, Left returns |
| Viewport under 1024px | one column at a time, full width; picking pushes right, a back row at the top returns (deferred: not in the first slice) |

Leaf targets: category `/?category=<slug>`, supplier `/suppliers/<slug>`,
space `/spaces` (no per-space page yet; deferred until one exists).

Loading: the column shows nothing until its request resolves, then rows reveal
with a 35ms stagger. A failed request shows one muted row reading
"Could not load" and the section stays selectable to retry.

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before
starting the next.

### 1. Header and empty overlay

Build: `AppHeader.vue` with wordmark and hamburger, `AppMenu.vue` as a reka-ui
dialog holding only the spine and utility strip, wired into `layouts/default.vue`.

Acceptance criteria:
- `/` renders the header with one `button[aria-label="Open menu"]` and no inline links.
- Clicking it renders `[role="dialog"]` with four spine buttons and Log in, Contact.
- Escape closes it and focus is back on the hamburger.
- With a session, the strip shows the email and a Log out button instead of Log in.
- `access.spec.ts` still passes: the spine only lists entries `canAccess` allows.

### 2. Products drill-down

Build: `useMenuTree.ts` loading `GET /categories` on first open, `AppMenuColumn.vue`,
three-level expansion for Products, leaf navigation.

Acceptance criteria:
- Clicking Products renders one column with the eight top-level categories.
- Clicking a category with children renders a second column; clicking one of its
  children with children renders a third.
- Clicking a leaf navigates to `/?category=<slug>` and the dialog is gone.
- Clicking Spaces after that removes every Products column.
- `GET /categories` is called once across open/close/open (spy on `$fetch`).
- When the request rejects, the column shows the single "Could not load" row.

### 3. Flat sections: Spaces and Suppliers

Build: loaders for `GET /spaces` and `GET /suppliers`, scroll and fade in
`AppMenuColumn.vue`.

Acceptance criteria:
- Clicking Spaces renders one column with 19 rows; the column's `scrollHeight`
  exceeds its `clientHeight` and no second column exists.
- Clicking Suppliers renders one column with the visible suppliers; clicking one
  navigates to `/suppliers/<slug>`.
- Clicking Brands turns the label ink and renders no column.

### 4. Route-aware reopen and keyboard (can be deferred; nothing depends on it)

Build: preselect the spine item from `activeNavPath`, arrow-key movement.

Acceptance criteria:
- On `/suppliers/kigali-build-supply`, opening the menu shows Suppliers ink with its
  column already out.
- With focus on a category, ArrowRight moves focus to the first row of the next
  column; ArrowLeft moves it back.

## Test approach

Component tests with `@nuxt/test-utils` `mountSuspended` under Vitest, stubbing
`$fetch` with the seeded category tree, spaces and suppliers fixtures. Pure logic
(which columns exist for a given selection, leaf target for an entry) lives in
`utils/menu.ts` and is unit-tested without mounting, following `line-views.spec.ts`.
