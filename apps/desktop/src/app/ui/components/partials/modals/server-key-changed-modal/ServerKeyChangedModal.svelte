<!-- Modified 2026 by Treslibre Project (Treslibre). -->
<script lang="ts">
  import type {AppServicesForSvelte} from '~/app/types';
  import Button from '~/app/ui/svelte-components/blocks/Button/Button.svelte';
  import {computeFingerprintIdenticon, type ServerKeyChangeAlert} from '~/common/observation';

  interface ServerKeyChangedModalProps {
    readonly alert: ServerKeyChangeAlert;
    readonly services: Pick<AppServicesForSvelte, 'electron'>;
    readonly onDismiss: () => void;
  }

  const {alert, services, onDismiss}: ServerKeyChangedModalProps = $props();

  let confirmManualOverrideStep = $state<boolean>(false);

  const oldIdenticon = $derived(computeFingerprintIdenticon(alert.old_fingerprint));
  const newIdenticon = $derived(computeFingerprintIdenticon(alert.new_fingerprint));

  function handleAbortConnection(): void {
    confirmManualOverrideStep = false;
    onDismiss();
  }

  async function handleAcceptNewKey(): Promise<void> {
    if (!confirmManualOverrideStep) {
      confirmManualOverrideStep = true;
      return;
    }
    confirmManualOverrideStep = false;
    await services.electron.acceptServerKeyOverride({
      component: alert.component,
      newFingerprint: alert.new_fingerprint,
      newLeafSha256: alert.new_leaf_sha256,
    });
    onDismiss();
  }
</script>

<div
  class="backdrop"
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="server-key-changed-title"
>
  <div class="modal-card">
    <h2 id="server-key-changed-title">Warning: Server Key / Certificate Changed</h2>
    <p class="warning-text">
      The cryptographic identity for <strong>{alert.component}</strong> on
      <code>{alert.host}</code> (Server ID: <code>{alert.server_id}</code>) does not match the
      pinned TOFU record and was not signed by the server administrator's Ed25519 key. All network
      traffic to this endpoint has been halted to prevent a potential Man-in-the-Middle (MitM)
      attack.
    </p>

    <div class="comparison-grid">
      <div class="fp-box">
        <h3>Pinned (Old) Fingerprint</h3>
        <div class="identicon">
          {#each oldIdenticon.cells as filled, idx (idx)}
            <span
              class:filled
              style:background-color={filled ? oldIdenticon.colorHex : 'transparent'}
            ></span>
          {/each}
        </div>
        <code>{alert.old_fingerprint}</code>
      </div>

      <div class="fp-box">
        <h3>Observed (New) Fingerprint</h3>
        <div class="identicon">
          {#each newIdenticon.cells as filled, idx (idx)}
            <span
              class:filled
              style:background-color={filled ? newIdenticon.colorHex : 'transparent'}
            ></span>
          {/each}
        </div>
        <code>{alert.new_fingerprint}</code>
      </div>
    </div>

    {#if confirmManualOverrideStep}
      <div class="secondary-warning">
        <strong>Secondary Confirmation Required:</strong> Accepting an unverified server key change
        will record an <code>unverified_manual_override</code> in your local audit log. Only proceed
        if you have verified the new fingerprint out-of-band with your server operator.
      </div>
    {/if}

    <div class="actions">
      <Button flavor="filled" onclick={handleAbortConnection}>Abort Connection (Default)</Button>
      <Button flavor="naked" onclick={handleAcceptNewKey}>
        {confirmManualOverrideStep
          ? 'Confirm Unverified Manual Override'
          : 'Accept New Server Key…'}
      </Button>
    </div>
  </div>
</div>

<style lang="scss">
  @use 'component' as *;

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: rem(24px);
  }

  .modal-card {
    max-width: rem(640px);
    width: 100%;
    background: var(--t-main-background-color);
    color: var(--t-text-e1-color);
    border: 2px solid var(--c-input-text-error-color);
    border-radius: rem(8px);
    padding: rem(24px);
    display: flex;
    flex-direction: column;
    gap: rem(16px);

    h2 {
      margin: 0;
      color: var(--c-input-text-error-color);
    }

    .warning-text {
      margin: 0;
      line-height: 1.45;
      color: var(--t-text-e2-color);
    }

    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: rem(12px);

      .fp-box {
        padding: rem(12px);
        border: 1px solid var(--t-panel-gap-color);
        border-radius: rem(6px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: rem(8px);

        h3 {
          margin: 0;
          font-size: rem(13px);
        }

        .identicon {
          display: grid;
          grid-template-columns: repeat(5, rem(10px));
          grid-template-rows: repeat(5, rem(10px));
          gap: rem(2px);
          padding: rem(4px);
          border: 1px solid var(--t-panel-gap-color);
        }

        code {
          font-family: monospace;
          font-size: rem(11px);
          word-break: break-all;
          text-align: center;
        }
      }
    }

    .secondary-warning {
      padding: rem(12px);
      border-radius: rem(6px);
      border: 1px solid var(--c-input-text-error-color);
      font-size: rem(13px);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: rem(12px);
    }
  }
</style>
