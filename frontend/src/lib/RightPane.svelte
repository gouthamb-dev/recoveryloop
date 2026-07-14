<script lang="ts">
  import type { OutputLine } from './types';

  export let outputLines: OutputLine[] = [];
  export let sessionId = '';
  export let isLoading = false;

  let terminalEl: HTMLDivElement;

  // Auto-scroll to bottom when new lines arrive
  $: if (outputLines.length && terminalEl) {
    requestAnimationFrame(() => {
      terminalEl.scrollTop = terminalEl.scrollHeight;
    });
  }

  function getLineClass(type: OutputLine['type']): string {
    const classes: Record<OutputLine['type'], string> = {
      info: 'line-info',
      stdout: 'line-stdout',
      stderr: 'line-stderr',
      error: 'line-error',
      success: 'line-success',
      retry: 'line-retry',
    };
    return classes[type] || 'line-info';
  }

  function copySessionId() {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
    }
  }
</script>

<div class="right-pane">
  {#if sessionId}
    <div class="session-badge" data-testid="session-badge">
      <span class="badge-label">Session:</span>
      <code>{sessionId}</code>
      <button class="copy-btn" on:click={copySessionId} title="Copy session ID" data-testid="copy-session-btn">
        📋
      </button>
    </div>
  {/if}

  <div class="terminal" bind:this={terminalEl} data-testid="terminal-output">
    {#if outputLines.length === 0 && !isLoading}
      <p class="placeholder">Output will appear here after you click Recover...</p>
    {/if}

    {#each outputLines as line}
      <div class="line {getLineClass(line.type)}">
        <span class="prefix">{line.type.toUpperCase()}</span>
        <span class="text">{line.text}</span>
      </div>
    {/each}

    {#if isLoading}
      <div class="line line-info spinner">
        <span class="dots">⣾</span> Processing...
      </div>
    {/if}
  </div>
</div>

<style>
  .right-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--md-surface-container-highest);
  }

  .session-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--md-surface-container-high);
    border-bottom: 1px solid var(--md-outline-variant);
    font-size: 0.8rem;
  }

  .badge-label {
    color: var(--md-on-surface-variant);
  }

  .session-badge code {
    color: var(--md-primary);
    font-size: 0.75rem;
  }

  .copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0 0.25rem;
  }

  .terminal {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    font-family: 'Fira Code', 'Consolas', 'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.6;
    background: var(--md-surface);
    margin: 0.5rem;
    border-radius: 12px;
    border: 1px solid var(--md-outline-variant);
  }

  .placeholder {
    color: var(--md-outline);
    font-style: italic;
  }

  .line {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    word-break: break-word;
  }

  .prefix {
    flex-shrink: 0;
    width: 5rem;
    text-align: right;
    font-weight: 600;
    opacity: 0.7;
    font-size: 0.7rem;
  }

  .text {
    white-space: pre-wrap;
  }

  .line-info { color: var(--md-on-surface-variant); }
  .line-stdout { color: var(--md-tertiary); }
  .line-stderr { color: var(--md-error); }
  .line-error { color: var(--md-on-error-container); }
  .line-success { color: var(--md-on-tertiary-container); }
  .line-retry { color: var(--md-secondary); }

  .spinner {
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
