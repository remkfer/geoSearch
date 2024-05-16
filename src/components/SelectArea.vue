<template>
    <div class="label">
      <p class="line">{{ label }}</p>
      <slot></slot> 
    </div>
</template>
  

<script setup>

const props = defineProps({
    label: {
        type: String
    }
});

</script>
  
<style lang="scss">
@import '/src/assets/scss/component/selectArea';

</style>