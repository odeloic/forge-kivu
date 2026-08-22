<template>
  <div>
    <header>
      <AppNav :entries="PRIMARY_NAV" />
      <AppSession />
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
