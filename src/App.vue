<template>
  <div class="app-view">
    <MainLayout />
  </div>
</template>

<script setup lang="ts">
// 多加一个层级，方便后期改router
import MainLayout from "./views/MainLayout.vue";
</script>
<style lang="scss" scoped>
.app-view {
  position: relative;
  width: 100vw;
  height: 100vh;
}
</style>
