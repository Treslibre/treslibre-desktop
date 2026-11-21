<!-- Modified 2026 by Treslibre Project (Treslibre). -->
<!--
  @component Renders a settings page for security settings and TOFU Server Trust & Keys (§4.4).
-->
<script lang="ts">
  import {onMount} from 'svelte';

  import {globals} from '~/app/globals';
  import {ROUTE_DEFINITIONS} from '~/app/routing/routes';
  import Text from '~/app/ui/components/atoms/text/Text.svelte';
  import KeyValueList from '~/app/ui/components/molecules/key-value-list';
  import type {SecuritySettingsProps} from '~/app/ui/components/partials/settings/internal/security-settings/props';
  import {i18n} from '~/app/ui/i18n';
  import {toast} from '~/app/ui/snackbar';
  import Button from '~/app/ui/svelte-components/blocks/Button/Button.svelte';
  import {computeFingerprintIdenticon, type ServerObservationRecord} from '~/common/observation';
  import {createScreenshotPreventionState} from '~/common/utils/settings';

  const {services, actions}: SecuritySettingsProps = $props();

  const log = globals.unwrap().uiLogging.logger('ui.component.security-settings');

  const {router} = services;

  let observationRecord = $state<ServerObservationRecord | undefined>(undefined);
  let showQrPayload = $state<boolean>(false);
  let confirmResetServer = $state<boolean>(false);

  async function refreshObservationRecord(): Promise<void> {
    try {
      observationRecord = await services.electron.getServerObservation();
    } catch (error) {
      log.warn('Unable to load server observation record:', error);
    }
  }

  async function handleCopyServerTrustJson(): Promise<void> {
    if (observationRecord === undefined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(observationRecord, undefined, 2));
      toast.addSimpleSuccess('Copied server trust & key fingerprints to clipboard.');
    } catch (error) {
      log.warn('Clipboard copy failed:', error);
    }
  }

  async function handleResetServerConfiguration(): Promise<void> {
    if (!confirmResetServer) {
      confirmResetServer = true;
      return;
    }
    confirmResetServer = false;
    await services.electron.resetServerObservation();
    observationRecord = undefined;
    toast.addSimpleSuccess('Pinned server trust record cleared.');
  }

  onMount(() => {
    refreshObservationRecord().catch((error: unknown) => {
      log.warn('Unable to refresh observation record:', error);
    });
  });

  const workSettingsViewStore = $derived(services.settings.views.work);
  const privacySettingsViewStore = $derived(services.settings.views.privacy);

  const screenshotPreventionState = $derived(
    createScreenshotPreventionState($workSettingsViewStore, $privacySettingsViewStore, log),
  );

  const screenshotPreventionLabel = $derived(
    screenshotPreventionState.enabled
      ? $i18n.t(
          'settings--security.label--prevent-screenshots-enabled',
          'Taking screenshots is disabled',
        )
      : $i18n.t(
          'settings--security.label--prevent-screenshots-disabled',
          'Taking screenshots is enabled',
        ),
  );

  const hintText = $derived(
    screenshotPreventionState.mode === 'mdm'
      ? $i18n.t(
          'settings--security.hint--prevent-screenshots-mdm',
          'This setting is managed by your organization.',
        )
      : $i18n.t(
          'settings--security.hint--prevent-screenshots-unsupported',
          'This setting is not supported on your system.',
        ),
  );

  function handleClickChangePassword(): void {
    router.go({modal: ROUTE_DEFINITIONS.modal.changePassword.withoutParams()});
  }

  function handleScreenshotPreventionUpdate(enabled: boolean): void {
    actions.updateSettings({localScreenshotPrevention: enabled});
  }
</script>

{#snippet screenshotPreventionSwitch()}
  <KeyValueList.ItemWithSwitch
    key={$i18n.t('settings--security.label--prevent-screenshots', 'No screenshots')}
    disabled={screenshotPreventionState.mode !== 'changeable'}
    checked={screenshotPreventionState.enabled}
    hint={screenshotPreventionState.mode === 'changeable' ? undefined : hintText}
    onswitch={(state) => handleScreenshotPreventionUpdate(state.new)}
  >
    <Text text={screenshotPreventionLabel}></Text>
  </KeyValueList.ItemWithSwitch>
{/snippet}

<KeyValueList>
  <KeyValueList.Section
    title={$i18n.t('settings--security.label--app-protection', 'App Protection')}
  >
    <KeyValueList.ItemWithButton icon="edit" key="" onclick={handleClickChangePassword}>
      <Text text={$i18n.t('settings--security.label--change-password', 'Change App Password')} />
    </KeyValueList.ItemWithButton>
    {@render screenshotPreventionSwitch()}
  </KeyValueList.Section>

  <KeyValueList.Section title="Server Trust &amp; Keys (TOFU Observation Store)">
    {#if observationRecord === undefined}
      <div class="server-trust-panel">
        <Text text="No TOFU server observation record is currently pinned for this profile." />
      </div>
    {:else}
      {@const chatIdenticon = computeFingerprintIdenticon(
        observationRecord.chat_server_pubkey_curve25519,
      )}
      <div class="server-trust-panel">
        <div class="trust-row">
          <strong>Active Server ID:</strong>
          <code>{observationRecord.server_id}</code>
        </div>
        <div class="trust-row">
          <strong>Pinned Chat Server Curve25519 Public Key:</strong>
          <code>{observationRecord.chat_server_pubkey_curve25519}</code>
        </div>
        <div class="trust-row">
          <strong>Directory Endpoint ({observationRecord.http_endpoints.directory.host}):</strong>
          <code>SPKI SHA-256: {observationRecord.http_endpoints.directory.spki_sha256}</code>
          <code>Leaf SHA-256: {observationRecord.http_endpoints.directory.leaf_sha256}</code>
        </div>
        <div class="trust-row">
          <strong>Blob Endpoint ({observationRecord.http_endpoints.blob.host}):</strong>
          <code>SPKI SHA-256: {observationRecord.http_endpoints.blob.spki_sha256}</code>
          <code>Leaf SHA-256: {observationRecord.http_endpoints.blob.leaf_sha256}</code>
        </div>
        <div class="trust-row">
          <strong>Safe Endpoint ({observationRecord.http_endpoints.safe.host}):</strong>
          <code>SPKI SHA-256: {observationRecord.http_endpoints.safe.spki_sha256}</code>
          <code>Leaf SHA-256: {observationRecord.http_endpoints.safe.leaf_sha256}</code>
        </div>
        <div class="trust-row">
          <strong>Admin Signing Ed25519 Public Key:</strong>
          <code>{observationRecord.admin_signing_pubkey_ed25519 ?? 'None'}</code>
        </div>
        <div class="trust-row">
          <strong>First Seen / Last Verified / Rotations:</strong>
          <code>
            First: {observationRecord.first_seen_at} | Last: {observationRecord.last_seen_at} | Rotations:
            {observationRecord.rotation_count}
          </code>
        </div>

        <div class="trust-actions">
          <Button flavor="naked" onclick={handleCopyServerTrustJson}>
            Copy Fingerprints (JSON)
          </Button>
          <Button flavor="naked" onclick={() => (showQrPayload = !showQrPayload)}>
            {showQrPayload
              ? 'Hide Out-of-Band Verification Matrix'
              : 'Show Out-of-Band Verification Matrix'}
          </Button>
          <Button flavor="naked" onclick={handleResetServerConfiguration}>
            {confirmResetServer
              ? 'Confirm Reset & Clear Pinned Server Record'
              : 'Reset Server Configuration…'}
          </Button>
        </div>

        {#if showQrPayload}
          <div class="verification-matrix">
            <div class="identicon">
              {#each chatIdenticon.cells as filled, idx (idx)}
                <span
                  class:filled
                  style:background-color={filled ? chatIdenticon.colorHex : 'transparent'}
                ></span>
              {/each}
            </div>
            <code>
              treslibre://verify-server?id={encodeURIComponent(
                observationRecord.server_id,
              )}&amp;chat_pk={observationRecord.chat_server_pubkey_curve25519}&amp;dir_spki={encodeURIComponent(
                observationRecord.http_endpoints.directory.spki_sha256,
              )}
            </code>
          </div>
        {/if}

        <div class="history-section">
          <strong
            >Key &amp; Certificate Rotation History ({observationRecord.history.length}):</strong
          >
          <ul>
            {#each observationRecord.history as item, idx (idx)}
              <li>
                <code>
                  [{item.timestamp}] {item.event} ({item.component}): {item.old_fingerprint ??
                    'none'} -&gt; {item.new_fingerprint} (admin_signed={item.verified_by_admin_key})
                </code>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  </KeyValueList.Section>
</KeyValueList>

<style lang="scss">
  @use 'component' as *;

  .server-trust-panel {
    display: flex;
    flex-direction: column;
    gap: rem(10px);
    padding: rem(12px) rem(16px);

    .trust-row {
      display: flex;
      flex-direction: column;
      gap: rem(2px);

      strong {
        font-size: rem(13px);
      }

      code {
        font-family: monospace;
        font-size: rem(11px);
        word-break: break-all;
      }
    }

    .trust-actions {
      display: flex;
      flex-wrap: wrap;
      gap: rem(8px);
      margin-top: rem(6px);
    }

    .verification-matrix {
      display: flex;
      align-items: center;
      gap: rem(12px);
      padding: rem(10px);
      border: 1px solid var(--t-panel-gap-color);
      border-radius: rem(6px);

      .identicon {
        display: grid;
        grid-template-columns: repeat(5, rem(8px));
        grid-template-rows: repeat(5, rem(8px));
        gap: rem(2px);
      }

      code {
        font-family: monospace;
        font-size: rem(11px);
        word-break: break-all;
      }
    }

    .history-section {
      margin-top: rem(8px);

      ul {
        margin: rem(6px) 0 0;
        padding-left: rem(18px);

        li {
          margin-bottom: rem(4px);

          code {
            font-family: monospace;
            font-size: rem(11px);
            word-break: break-all;
          }
        }
      }
    }
  }
</style>
