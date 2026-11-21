<!--
  Modified 2026 by Treslibre Project (Treslibre).
  @component Renders the Treslibre logo.
-->
<script lang="ts">
  import type {u53} from '@threema/ts-utils/integer/u53';
  import {clamp} from '@threema/ts-utils/number/clamp';

  import type {LogoProps} from '~/app/ui/components/partials/logo/props';

  const {animated = false, oncompletion, progress}: LogoProps = $props();

  let animationEndCount = $state<u53>(0);

  function handleAnimationEnd(event: AnimationEvent): void {
    animationEndCount += 1;

    // Because the observed element has two animations, fire callback only when the second one is
    // complete as well.
    if (animationEndCount >= 2) {
      animationEndCount = 0;
      oncompletion?.();
    }
  }
</script>

<span class="logo">
  <svg
    class="content"
    class:animated
    data-progress={progress ?? 'undefined'}
    viewBox="0 0 96 121"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <defs>
      <mask id="treslibre-logo-lock-cutout-mask">
        <rect width="100%" height="100%" fill="white" />

        <!-- Geometric keyhole shape -->
        <circle cx="48" cy="41" r="6" fill="black" />
        <path d="M44,45 H52 L50.5,60 H45.5 Z" fill="black" />
      </mask>

      <mask id="treslibre-logo-checkmark-cutout-mask">
        <rect width="100%" height="100%" fill="white" />

        <!-- Geometric checkmark shape -->
        <path
          d="M35,48 L44,57 L62,37"
          fill="none"
          stroke="black"
          stroke-width="6.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </mask>

      <filter id="treslibre-logo-morph-blur-filter">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feColorMatrix
          in="blur"
          mode="matrix"
          values="1  0  0   0   0
                  0  1  0   0   0
                  0  0  1   0   0
                  0  0  0  20 -10"
          result="treslibre-logo-morph-blur-filter"
        />
        <feComposite in="SourceGraphic" in2="treslibre-logo-morph-blur-filter" operator="atop" />
      </filter>
    </defs>

    <g transform="translate(0, 2)">
      <!-- Do not show the logo in custom builds -->
      {#if import.meta.env.BUILD_VARIANT !== 'custom'}
        <!-- Shield outline -->
        <path
          class="bubble"
          d="M48,5 L84,18 V49 C84,71 67,84 48,91 C29,84 12,71 12,49 V18 Z M48,17 L24,26 V49 C24,64 36,74 48,79 C60,74 72,64 72,49 V26 Z"
          fill="currentColor"
          fill-rule="evenodd"
        />

        <!-- Icon containers -->
        <path
          class="lock"
          fill="currentColor"
          d="M48,17 L72,26 V49 C72,64 60,74 48,79 C36,74 24,64 24,49 V26 Z"
          mask="url(#treslibre-logo-lock-cutout-mask)"
        />
      {/if}

      <path
        class="checkmark"
        fill="currentColor"
        d="M48,17 L72,26 V49 C72,64 60,74 48,79 C36,74 24,64 24,49 V26 Z"
        mask="url(#treslibre-logo-checkmark-cutout-mask)"
        onanimationend={handleAnimationEnd}
      />

      <!-- Progress bar track -->
      <rect
        class="progress-bar-track"
        x="20"
        y="102"
        width="56"
        height="10"
        rx="5"
        fill="rgba(0, 0, 0, 0.35)"
      />

      <g fill="currentColor" filter="url(#treslibre-logo-morph-blur-filter)">
        <!-- Sizing helper -->
        <rect x="0" y="0" width="96" height="111" fill="transparent" />

        <!-- Progress bar -->
        <rect
          class="progress-bar"
          x="18"
          y="102"
          width={clamp(60 * (progress === 'unknown' ? 0 : (progress ?? 1)), {min: 24})}
          height="10"
          rx="5"
        />

        <!-- Security bars -->
        <g class="dots">
          <rect class="dot" x="18" y="102" width="16" height="10" rx="3" />
          <rect class="dot" x="40" y="102" width="16" height="10" rx="3" />
          <rect class="dot" x="62" y="102" width="16" height="10" rx="3" />
        </g>
      </g>
    </g>
  </svg>
</span>

<style lang="scss">
  @use 'component' as *;

  .logo {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    width: 100%;
    height: 100%;

    .content {
      position: relative;
      display: inline-block;

      width: 100%;
      height: auto;

      .lock {
        opacity: 1;
      }

      .checkmark {
        opacity: 0;
      }

      .progress-bar-track {
        opacity: 1;
      }

      .progress-bar {
        opacity: 1;

        fill: var(--cc-logo-progress-bar-fill-color);
      }

      .dots {
        opacity: 0;
      }

      &[data-progress='1'].animated {
        .bubble {
          // Play jump animation once.
          animation: jump 0.45s ease-out 0.8s 1 normal forwards;
        }

        .lock {
          // Hide lock icon.
          transform-origin: 48px 41px;
          animation:
            jump 0.5s ease-out 0.9s 1 normal forwards,
            spin-out 0.3s ease-in 1.65s 1 normal forwards;
        }

        .checkmark {
          // Reveal checkmark icon.
          transform-origin: 48px 41px;
          animation:
            jump 0.5s ease-out 0.9s 1 normal forwards,
            spin-in 0.3s ease-out 1.65s 1 normal forwards;
        }

        .progress-bar-track {
          opacity: 0;
        }

        .progress-bar {
          // Hide progress bar.
          transform-origin: center bottom;
          animation: reveal 0.5s ease-out 0.25s 1 reverse forwards;
        }

        .dots {
          // Reveal dots.
          transform-origin: center bottom;
          animation: reveal 0.5s ease-out 0.25s 1 normal forwards;

          fill: var(--cc-logo-progress-bar-fill-color);

          .dot {
            // Play bounce animation once.
            animation: bounce 1.25s linear 1 normal forwards;

            &:nth-child(1) {
              transform-origin: 20% bottom;
              animation-delay: 0.3s;
            }

            &:nth-child(2) {
              transform-origin: center bottom;
              animation-delay: 0.4s;
            }

            &:nth-child(3) {
              transform-origin: 80% bottom;
              animation-delay: 0.5s;
            }
          }
        }
      }

      &[data-progress='unknown'].animated {
        .progress-bar-track {
          opacity: 0;
        }

        .progress-bar {
          opacity: 0;
        }

        .dots {
          opacity: 1;
          fill: var(--cc-logo-progress-bar-fill-color);

          .dot {
            // Play bounce animation once.
            animation: bounce 1.25s linear infinite normal forwards;

            &:nth-child(1) {
              transform-origin: 20% bottom;
              animation-delay: 0s;
            }

            &:nth-child(2) {
              transform-origin: center bottom;
              animation-delay: 0.1s;
            }

            &:nth-child(3) {
              transform-origin: 80% bottom;
              animation-delay: 0.2s;
            }
          }
        }
      }

      &[data-progress='undefined'] {
        .lock {
          opacity: 1;
        }

        .checkmark {
          opacity: 0;
        }

        .progress-bar-track {
          opacity: 0;
        }

        .progress-bar {
          opacity: 0;
        }

        .dots {
          opacity: 1;
        }
      }
    }
  }

  @keyframes reveal {
    0% {
      opacity: 0;
      transform: scale(0.75, 0.75);
    }
    100% {
      opacity: 1;
      transform: scale(1, 1);
    }
  }

  @keyframes spin-in {
    0%,
    40% {
      opacity: 0;
      transform: rotate(45deg);
    }
    50% {
      opacity: 1;
    }
    80% {
      transform: rotate(-25deg);
    }
    100% {
      opacity: 1;
      transform: rotate(0deg);
    }
  }

  @keyframes spin-out {
    0% {
      opacity: 1;
      transform: rotate(0deg);
    }
    45% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
      transform: rotate(-60deg);
    }
  }

  @keyframes jump {
    0% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-5px);
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes bounce {
    0% {
      transform: scale(1, 1) translateY(0);
    }
    10% {
      transform: scale(1, 1) translateY(0);
    }
    30% {
      transform: scale(1.175, 0.75) translateY(0);
    }
    35% {
      transform: scale(0.8, 1.2) translateY(0);
    }
    48% {
      transform: scale(1.125, 0.8) translateY(-15px);
    }
    50% {
      transform: scale(1.125, 0.8) translateY(-16px);
    }
    65% {
      transform: scale(1.125, 0.8) translateY(0);
    }
    70%,
    100% {
      transform: scale(1, 1) translateY(0);
    }
  }
</style>
