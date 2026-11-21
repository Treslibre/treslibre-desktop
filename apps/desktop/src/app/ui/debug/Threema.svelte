<!--
  Modified 2026 by Treslibre Project (Treslibre).
-->
<script lang="ts">
  import type {AppServicesForSvelte} from '~/app/types';
  import {unusedProp} from '~/common/utils/svelte-helpers';

  interface Props {
    services: AppServicesForSvelte;
  }

  const {services}: Props = $props();

  unusedProp(services);
</script>

<section class="threema">
  <h2>Treslibre Project</h2>
  <a
    href="https://github.com/Treslibre/treslibre-desktop"
    target="_blank"
    rel="noreferrer noopener"
  >
    Treslibre Source Repository
  </a>
</section>

<style lang="scss">
  @use 'component' as *;

  .threema {
    display: grid;
    place-items: center;
  }
</style>
