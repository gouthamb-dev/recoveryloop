<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isLoading = false;

  let userPrompt = '';
  let codeContext = '';
  let sessionId = '';

  const dispatch = createEventDispatcher<{
    submit: { userPrompt: string; codeContext: string; sessionId: string };
  }>();

  function handleSubmit() {
    if (!userPrompt.trim() || isLoading) return;
    dispatch('submit', {
      userPrompt: userPrompt.trim(),
      codeContext,
      sessionId: sessionId.trim(),
    });
  }
</script>

<div class="left-pane">
  <h2>Recovery Loop</h2>

  <label for="session-id-input">Resume Session ID (optional)</label>
  <input
    id="session-id-input"
    type="text"
    placeholder="Enter a prior session ID..."
    bind:value={sessionId}
    disabled={isLoading}
    data-testid="session-id-input"
  />

  <label for="user-prompt-input">What are you trying to fix?</label>
  <input
    id="user-prompt-input"
    type="text"
    placeholder="e.g., My npm install fails with EACCES"
    bind:value={userPrompt}
    disabled={isLoading}
    data-testid="user-prompt-input"
  />

  <label for="code-context-textarea">Broken code / error output</label>
  <textarea
    id="code-context-textarea"
    placeholder="Paste your error output, broken script, or describe the blocked goal..."
    bind:value={codeContext}
    disabled={isLoading}
    rows="12"
    data-testid="code-context-textarea"
  ></textarea>

  <button
    on:click={handleSubmit}
    disabled={isLoading || !userPrompt.trim()}
    data-testid="recover-button"
  >
    {isLoading ? 'Running...' : 'Recover'}
  </button>
</div>

<style>
  .left-pane {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem;
    height: 100%;
    overflow-y: auto;
    box-sizing: border-box;
  }

  h2 {
    margin: 0 0 0.5rem 0;
    color: var(--md-primary);
    font-size: 1.25rem;
  }

  label {
    font-size: 0.75rem;
    color: var(--md-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  input, textarea {
    background: var(--md-surface);
    border: 1px solid var(--md-outline);
    border-radius: 8px;
    color: var(--md-on-surface);
    padding: 0.625rem 0.875rem;
    font-family: inherit;
    font-size: 0.9rem;
    transition: border-color 0.2s;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: var(--md-primary);
    box-shadow: 0 0 0 1px var(--md-primary);
  }

  textarea {
    resize: vertical;
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.85rem;
  }

  button {
    margin-top: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--md-primary);
    color: var(--md-on-primary);
    border: none;
    border-radius: 20px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }

  button:hover:not(:disabled) {
    background: var(--md-on-primary-container);
    box-shadow: 0 2px 6px rgba(0,0,0,0.16);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
