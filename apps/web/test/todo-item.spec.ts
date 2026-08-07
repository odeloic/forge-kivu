import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import TodoItem from '~/components/TodoItem.vue'

describe('TodoItem', () => {
  it('renders the todo title', async () => {
    const wrapper = await mountSuspended(TodoItem, {
      props: {
        todo: { id: 'a1', title: 'render me', completed: false },
      },
    })
    expect(wrapper.text()).toContain('render me')
  })

  it('marks completed todos', async () => {
    const wrapper = await mountSuspended(TodoItem, {
      props: {
        todo: { id: 'a1', title: 'done', completed: true },
      },
    })
    expect(wrapper.find('span').classes()).toContain('completed')
  })
})
