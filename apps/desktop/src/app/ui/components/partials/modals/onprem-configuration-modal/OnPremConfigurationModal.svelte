<!-- Modified 2026 by Treslibre Project (Treslibre). -->
<script lang="ts">
  import {u8aToBase64} from '@threema/ts-utils/base64/u8a-to-base64';
  import {UTF8} from '@threema/ts-utils/codec/utf8';
  import {onDestroy, onMount} from 'svelte';

  import {globals} from '~/app/globals';
  import Input from '~/app/ui/components/atoms/input/Input.svelte';
  import Text from '~/app/ui/components/atoms/text/Text.svelte';
  import {checkAndCompleteUrl} from '~/app/ui/components/partials/modals/onprem-configuration-modal/helpers';
  import type {OnPremConfigurationModalProps} from '~/app/ui/components/partials/modals/onprem-configuration-modal/props';
  import {i18n} from '~/app/ui/i18n';
  import Step from '~/app/ui/linking/Step.svelte';
  import Button from '~/app/ui/svelte-components/blocks/Button/Button.svelte';
  import Password from '~/app/ui/svelte-components/blocks/Input/Password.svelte';
  import {STATIC_CONFIG} from '~/common/config';
  import type {ServerTrustPreview} from '~/common/electron-ipc';
  import {assertUnreachable} from '~/common/utils/assert';

  const log = globals.unwrap().uiLogging.logger('ui.component.onprem.oppf');

  const {oppfConfig, services}: OnPremConfigurationModalProps = $props();

  let oppfUrlInputComponent = $state<Input>();

  let ingestionMode = $state<'url' | 'file' | 'qr'>('url');
  let oppfUrl = $state<string>(import.meta.env.URLS.presetOppfUrl?.full ?? '');
  let password = $state<string>('');
  let username = $state<string>('');
  let qrPayloadText = $state<string>('');
  let importedFileName = $state<string>('');
  let importedDataUri = $state<string>('');

  let submitError: string | undefined = $state(undefined);
  let trustPreview: ServerTrustPreview | undefined = $state(undefined);
  let resolvedProvisioningUrl = $state<string>('');

  function handleFileChange(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (file === undefined) {
      return;
    }
    importedFileName = file.name;
    file
      .arrayBuffer()
      .then((buffer) => {
        const base64 = u8aToBase64(new Uint8Array(buffer));
        importedDataUri = `data:application/json;base64,${base64}`;
        submitError = undefined;
      })
      .catch((error: unknown) => {
        log.error('Failed to read local provisioning file:', error);
        submitError = 'Failed to read the selected provisioning file.';
      });
  }

  function resolveSourceUrl(): URL {
    if (ingestionMode === 'file') {
      if (importedDataUri === '') {
        throw new Error('No provisioning file selected');
      }
      return new URL(importedDataUri);
    }
    if (ingestionMode === 'qr') {
      const trimmed = qrPayloadText.trim();
      if (trimmed === '') {
        throw new Error('Empty QR payload');
      }
      if (trimmed.startsWith('{') || trimmed.includes('"version"')) {
        const base64 = u8aToBase64(UTF8.encode(trimmed));
        return new URL(`data:application/json;base64,${base64}`);
      }
      if (trimmed.startsWith('treslibre://') || trimmed.startsWith('https://')) {
        const parsedUri = new URL(trimmed);
        const serverParam = parsedUri.searchParams.get('server');
        if (serverParam !== null && serverParam !== '') {
          return checkAndCompleteUrl(serverParam);
        }
      }
      return checkAndCompleteUrl(trimmed);
    }
    return checkAndCompleteUrl(oppfUrl);
  }

  async function handleClickConfirm(): Promise<void> {
    if (trustPreview !== undefined) {
      await handleConfirmTrust();
      return;
    }

    try {
      const url = resolveSourceUrl();
      const status = await services.electron.checkOppFile(
        url.toString(),
        username,
        password,
        STATIC_CONFIG.USER_AGENT,
      );

      if (status === 200) {
        resolvedProvisioningUrl = url.toString();
        try {
          const fetchedPreview = await services.electron.previewServerProvisioning(
            resolvedProvisioningUrl,
            username,
            password,
            STATIC_CONFIG.USER_AGENT,
          );
          trustPreview = fetchedPreview;
          submitError = undefined;
        } catch (previewError) {
          log.warn(
            'Unable to build TOFU trust preview, proceeding with direct verification:',
            previewError,
          );
          oppfConfig.resolve({
            password,
            username,
            oppfUrl: resolvedProvisioningUrl,
          });
        }
      } else if (status === 401) {
        submitError = $i18n.t(
          'dialog--linking-oppf.error--credentials-error',
          'The provided credentials are incorrect. Please check that the combination of URL and work credentials is correct or contact your administrator.',
        );
      } else {
        log.warn('OPPF fetch failed with status code ', status);
        submitError = $i18n.t(
          'dialog--linking-oppf.error--fetch-error',
          'The provided URL is invalid. Please check that the combination of URL and work credentials is correct or contact your administrator.',
        );
      }
    } catch (error) {
      log.error(error);
      submitError = $i18n.t(
        'dialog--linking-oppf.error--fetch-error-connection',
        'The provided URL is not accessible. Please check your network connection or contact your administrator.',
      );
    }
  }

  async function handleConfirmTrust(): Promise<void> {
    if (trustPreview === undefined) {
      return;
    }
    try {
      await services.electron.pinInitialServerObservation(trustPreview);
    } catch (pinError) {
      log.warn('Failed to persist initial server observation pin:', pinError);
    }
    oppfConfig.resolve({
      password,
      username,
      oppfUrl: resolvedProvisioningUrl,
    });
  }

  function handleCancelTrust(): void {
    trustPreview = undefined;
  }

  function handleKeydownEvent(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      handleClickConfirm().catch(assertUnreachable);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydownEvent);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydownEvent);
  });
</script>

<Step>
  {#if trustPreview !== undefined}
    <header>
      <h1>First-Time Server Trust Prompt (TOFU)</h1>
      <p class="intro">
        <Text
          text="Verify the server's cryptographic identity and TLS SPKI SHA-256 fingerprint before trusting and pinning this server."
        />
      </p>
    </header>
    <div class="body">
      <div class="tofu-card">
        <div class="tofu-row">
          <span class="tofu-label">Server Hostname / ID:</span>
          <code>{trustPreview.server_id} ({trustPreview.chat_host}:{trustPreview.chat_port})</code>
        </div>
        <div class="tofu-row">
          <span class="tofu-label">Chat Server Public Key (Curve25519):</span>
          <code>{trustPreview.chat_server_pubkey_curve25519}</code>
        </div>
        <div class="tofu-row">
          <span class="tofu-label"
            >Directory TLS SPKI SHA-256 ({trustPreview.http_endpoints.directory.host}):</span
          >
          <code>{trustPreview.http_endpoints.directory.spki_sha256}</code>
        </div>
        <div class="tofu-row">
          <span class="tofu-label"
            >Blob TLS SPKI SHA-256 ({trustPreview.http_endpoints.blob.host}):</span
          >
          <code>{trustPreview.http_endpoints.blob.spki_sha256}</code>
        </div>
        <div class="tofu-row">
          <span class="tofu-label"
            >Safe TLS SPKI SHA-256 ({trustPreview.http_endpoints.safe.host}):</span
          >
          <code>{trustPreview.http_endpoints.safe.spki_sha256}</code>
        </div>
        {#if trustPreview.admin_signing_pubkey_ed25519 !== null}
          <div class="tofu-row">
            <span class="tofu-label">Admin Signing Public Key (Ed25519):</span>
            <code>{trustPreview.admin_signing_pubkey_ed25519}</code>
          </div>
        {/if}
      </div>
    </div>
    <div class="footer">
      <Button flavor="naked" onclick={handleCancelTrust}>
        {$i18n.t('dialog--common.action--cancel', 'Cancel')}
      </Button>
      <Button flavor="filled" onclick={handleConfirmTrust}>Trust &amp; Pin Server</Button>
    </div>
  {:else}
    <header>
      <h1>
        {$i18n.t('dialog--linking-oppf.label--oppf-file', '{fullAppName}', {
          fullAppName: import.meta.env.APP_NAME,
        })}
      </h1>
      <p class="intro">
        {#if import.meta.env.BUILD_VARIANT === 'custom'}
          <Text
            text={$i18n.t(
              'dialog--linking-oppf.prose--enter-config-short',
              'Please enter the credentials provided by your organization.',
            )}
          />
        {:else}
          <Text
            text={$i18n.t(
              'dialog--linking-oppf.prose--enter-config',
              'Connect to a self-hosted Treslibre server via HTTPS URL, local provisioning file (.oppf / .tlpf / .json), or QR code payload.',
              {
                fullAppName: import.meta.env.APP_NAME,
              },
            )}
          />
        {/if}
      </p>
    </header>

    <div class="body">
      <div class="mode-tabs">
        <button
          type="button"
          class:active={ingestionMode === 'url'}
          onclick={() => (ingestionMode = 'url')}
        >
          HTTPS URL
        </button>
        <button
          type="button"
          class:active={ingestionMode === 'file'}
          onclick={() => (ingestionMode = 'file')}
        >
          Import .oppf / .json
        </button>
        <button
          type="button"
          class:active={ingestionMode === 'qr'}
          onclick={() => (ingestionMode = 'qr')}
        >
          QR Payload
        </button>
      </div>

      <Input
        id="work_username"
        autofocus
        label={$i18n.t('dialog--linking-oppf.label--username', 'Username (optional)')}
        bind:value={username}
      />
      <Password
        label={$i18n.t('dialog--linking-oppf.label--password', 'Password (optional)')}
        bind:value={password}
      />

      {#if ingestionMode === 'url'}
        <Input
          bind:this={oppfUrlInputComponent}
          bind:value={oppfUrl}
          disabled={import.meta.env.URLS.presetOppfUrl !== undefined}
          id="oppf_url"
          label={$i18n.t('dialog--linking-oppf.label--url', 'URL')}
          onfocus={() => oppfUrlInputComponent?.select()}
        />
      {:else if ingestionMode === 'file'}
        <div class="file-picker">
          <label for="oppf_file_input">Select provisioning file (.oppf, .tlpf, .json):</label>
          <input
            id="oppf_file_input"
            type="file"
            accept=".oppf,.tlpf,.json,application/json"
            onchange={handleFileChange}
          />
          {#if importedFileName !== ''}
            <span class="file-name">Loaded: {importedFileName}</span>
          {/if}
        </div>
      {:else}
        <Input
          id="oppf_qr_payload"
          label="QR Provisioning URL or JSON Payload"
          bind:value={qrPayloadText}
        />
      {/if}

      {#if submitError !== undefined}
        <div class="error">
          <Text text={submitError} color="inherit" family="secondary" />
        </div>
      {/if}

      <div class="info">
        <Text
          text={$i18n.t(
            'dialog--linking-oppf.prose--forget-credentials',
            'Forgot your credentials? Please contact your {fullAppName} administrator.',
            {
              fullAppName: import.meta.env.APP_NAME,
            },
          )}
        />
      </div>
    </div>
    <div class="footer">
      <Button flavor="filled" onclick={handleClickConfirm}>
        {$i18n.t('dialog--common.action--next', 'Next')}
      </Button>
    </div>
  {/if}
</Step>

<style lang="scss">
  @use 'component' as *;

  h1,
  p {
    padding: 0;
    margin: 0;
  }

  header {
    display: grid;
    gap: rem(8px);
    margin-bottom: rem(24px);

    h1 {
      @extend %font-large-400;
    }

    .intro {
      color: var(--t-text-e2-color);
    }
  }

  .body {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: start;
    gap: rem(8px);

    color: var(--t-text-e2-color);

    .mode-tabs {
      display: flex;
      gap: rem(8px);
      margin-bottom: rem(8px);

      button {
        flex: 1;
        padding: rem(6px) rem(10px);
        border: 1px solid var(--t-panel-gap-color);
        border-radius: rem(4px);
        background: transparent;
        color: inherit;
        cursor: pointer;

        &.active {
          border-color: currentColor;
          font-weight: 600;
        }
      }
    }

    .file-picker {
      display: flex;
      flex-direction: column;
      gap: rem(6px);
      padding: rem(8px) 0;

      .file-name {
        font-size: rem(12px);
      }
    }

    .tofu-card {
      display: flex;
      flex-direction: column;
      gap: rem(10px);
      padding: rem(12px);
      border: 1px solid var(--t-panel-gap-color);
      border-radius: rem(6px);

      .tofu-row {
        display: flex;
        flex-direction: column;
        gap: rem(2px);

        .tofu-label {
          font-size: rem(12px);
          font-weight: 600;
        }

        code {
          font-family: monospace;
          font-size: rem(11px);
          word-break: break-all;
        }
      }
    }

    .info {
      margin-top: rem(12px);
    }
    .error {
      margin-top: rem(12px);
      color: var(--c-input-text-error-color);
    }
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: end;
    gap: rem(8px);
    padding: rem(16px);
  }
</style>
