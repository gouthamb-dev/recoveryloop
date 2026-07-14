<script lang="ts">
  import LeftPane from './lib/LeftPane.svelte';
  import RightPane from './lib/RightPane.svelte';
  import { submitSession } from './lib/api';
  import type { OutputLine, SseEvent } from './lib/types';

  let sessionId = '';
  let outputLines: OutputLine[] = [];
  let isLoading = false;

  function addLine(type: OutputLine['type'], text: string) {
    outputLines = [
      ...outputLines,
      { type, text, timestamp: new Date().toISOString() },
    ];
  }

  function mapEventType(sseType: string): OutputLine['type'] {
    const map: Record<string, OutputLine['type']> = {
      session_start: 'info',
      bedrock_start: 'info',
      script_generated: 'info',
      sandbox_start: 'info',
      stdout: 'stdout',
      stderr: 'stderr',
      retry: 'retry',
      final: 'success',
      error: 'error',
    };
    return map[sseType] || 'info';
  }

  async function handleSubmit(event: CustomEvent<{ userPrompt: string; codeContext: string; sessionId: string }>) {
    const { userPrompt, codeContext, sessionId: inputSessionId } = event.detail;

    // Reset state
    outputLines = [];
    isLoading = true;

    addLine('info', 'Submitting to Recovery Loop...');

    await submitSession(
      {
        userPrompt,
        codeContext,
        sessionId: inputSessionId || undefined,
      },
      (sseEvent: SseEvent) => {
        const lineType = mapEventType(sseEvent.type);

        if (sseEvent.type === 'session_start') {
          sessionId = sseEvent.payload;
          addLine('info', `Session: ${sseEvent.payload}`);
        } else if (sseEvent.type === 'script_generated') {
          addLine('info', '─── Generated Script ───');
          addLine('stdout', sseEvent.payload);
          addLine('info', '────────────────────────');
        } else if (sseEvent.type === 'final') {
          const status = sseEvent.payload;
          const meta = sseEvent.metadata || {};
          addLine(
            status === 'success' ? 'success' : 'error',
            `${meta.message || status} (${meta.retryCount || 0} retries, ${meta.executionTimeMs || 0}ms)`
          );
        } else {
          addLine(lineType, sseEvent.payload);
        }
      },
      (completedSessionId: string) => {
        if (completedSessionId) sessionId = completedSessionId;
        isLoading = false;
      },
      (error: Error) => {
        addLine('error', `Connection error: ${error.message}`);
        isLoading = false;
      }
    );
  }
</script>

<main>
  <div class="split-layout">
    <div class="pane left">
      <LeftPane {isLoading} on:submit={handleSubmit} />
    </div>
    <div class="pane right">
      <RightPane {outputLines} {sessionId} {isLoading} />
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--md-background);
    color: var(--md-on-background);
    height: 100vh;
    overflow: hidden;
  }

  :global(#app) {
    height: 100vh;
  }

  main {
    height: 100vh;
  }

  .split-layout {
    display: flex;
    height: 100%;
  }

  .pane {
    height: 100%;
    overflow: hidden;
  }

  .left {
    width: 40%;
    border-right: 1px solid var(--md-outline-variant);
    background: var(--md-surface-container);
  }

  .right {
    width: 60%;
    background: var(--md-surface-container-highest);
  }
</style>
