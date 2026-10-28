<script setup>
// <Embed src="/embeds/x.html" title="..." height="720" /> shows an HTML file
// from docs/public in a frame, with a link to open it full screen.
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps({
  src: { type: String, required: true },
  title: { type: String, default: '' },
  height: { type: [String, Number], default: 720 },
})
const { theme } = useData()
const url = computed(() => withBase(props.src))
const frameHeight = computed(() => (/^\d+$/.test(String(props.height)) ? `${props.height}px` : props.height))
</script>

<template>
  <figure class="ddk-embed">
    <iframe :src="url" :title="title" :style="{ height: frameHeight }" loading="lazy" />
    <figcaption>
      <span>{{ title }}</span>
      <a :href="url" target="_blank" rel="noopener">{{ theme.embedOpenLabel || 'Open full screen' }} ↗</a>
    </figcaption>
  </figure>
</template>
