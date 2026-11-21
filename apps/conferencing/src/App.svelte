<!-- Modified 2026 by Treslibre Project (Treslibre). -->
<script lang="ts">
  import {Button} from '@threema/ui';

  const brandings = ['consumer', 'work', 'onprem'] as const;
  type Branding = (typeof brandings)[number];

  let currentBranding = $state<Branding>(
    (document.documentElement.dataset.branding as Branding | undefined) ?? 'consumer',
  );

  function setBranding(branding: Branding): void {
    currentBranding = branding;
    document.documentElement.dataset.branding = branding;
    localStorage.setItem('branding', branding);
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
  <h1 class="text-3xl font-bold text-primary-700">Treslibre Conferencing</h1>

  <p class="text-neutral-600 max-w-md text-center">Welcome to Treslibre Conferencing.</p>

  <div class="flex flex-wrap justify-center gap-4">
    <Button log={console} variant="primary">Join Call</Button>
    <Button log={console} variant="secondary">Learn More</Button>
  </div>

  <label>
    Branding:
    <select
      value={currentBranding}
      onchange={(event) => setBranding(event.currentTarget.value as Branding)}
    >
      {#each brandings as branding (branding)}
        <option value={branding}>{branding}</option>
      {/each}
    </select>
  </label>

  <p class="text-neutral-400 text-sm">
    The buttons above use <code class="font-mono">@threema/ui</code>, themed via
    <code class="font-mono">@threema/branding</code>.
  </p>

  <footer class="text-neutral-500 mt-8 border-t pt-4 text-center text-xs">
    <p>
      Modified 2026 by Treslibre Project (Treslibre), an independent fork of Threema (© Threema AG).
      Not affiliated with or endorsed by Threema AG.
    </p>
    <p class="mt-1">
      Licensed under GNU AGPL-3.0-or-later. Corresponding Source Code:
      <a
        class="underline"
        href="https://github.com/Treslibre/treslibre-desktop"
        rel="noreferrer noopener"
        target="_blank"
      >
        https://github.com/Treslibre/treslibre-desktop
      </a>
    </p>
  </footer>
</main>
