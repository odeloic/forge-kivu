<template>
  <div>
    <header>
      <AppNav :entries="PRIMARY_NAV" />
      <AppSession />
      <AppNav :entries="WORKSHOP_NAV" />
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
