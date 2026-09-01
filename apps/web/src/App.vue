<template>
  <div class="app-shell">
    <AppHeader v-if="!isPhoto && !isAdmin" />
    <ViewSelector v-if="isPublic" class="global-view-selector" :class="{ 'is-scrolled': scrolled, 'is-discover': isDiscover }" :active="isDiscover ? 'discover' : 'gallery'" @select="selectView" />
    <RouterView v-slot="{ Component }">
      <KeepAlive include="DiscoverView">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AppHeader from './components/AppHeader.vue';
import ViewSelector from './components/ViewSelector.vue';

const route = useRoute();
const router = useRouter();
const isPhoto = computed(() => route.path.startsWith('/photo/'));
const isAdmin = computed(() => route.path.startsWith('/admin') || route.path.startsWith('/account'));
const isDiscover = computed(() => route.path.startsWith('/discover'));
const isPublic = computed(() => !isAdmin.value && !isPhoto.value);
const scrolled = ref(false);
function onScroll(): void { scrolled.value = window.scrollY > 80; }
function selectView(value: 'gallery' | 'discover'): void { void router.push({ path: value === 'discover' ? '/discover' : '/', query: route.query }); }
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>
