<template>
  <button
    type="button"
    class="rounded-full h-8 w-8 bg-foreground text-foundation hover:text-primary flex justify-center items-center ring-offset-foundation focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition"
    @click="onClick"
  >
    <span class="sr-only">Toggle dark mode</span>
    <Icon class="h-4 w-4" aria-hidden="true" />
  </button>
</template>
<script setup lang="ts">
import { SunIcon, MoonIcon } from '@heroicons/vue/24/solid'
import { useTheme, AppTheme } from '~~/lib/core/composables/theme'

const { isDarkTheme, setTheme } = useTheme()
const Icon = computed(() => (isDarkTheme.value ? SunIcon : MoonIcon))

const onClick = () => {
  if (isDarkTheme.value) {
    setTheme(AppTheme.Light)
  } else {
    setTheme(AppTheme.Dark)
  }
}
</script>
