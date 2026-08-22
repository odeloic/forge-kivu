<template>
  <div>
    <header>
      <AppNav :entries="PRIMARY_NAV" />
      <AppSession />
      <AppNav :entries="ADMIN_NAV" />
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
