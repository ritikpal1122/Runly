// Better error messages — add context-aware diagnostics to raw Playwright errors

export function enhanceError(rawError, step, context = {}) {
  const raw = rawError.message || String(rawError);

  // Element not found
  if (raw.includes('not found') || raw.includes('locator.click: Timeout')) {
    return {
      technical: raw.split('\n')[0],
      plain: `Could not find the element described as "${step.selector?.value || step.selector?.name || 'target'}". The page may have changed, or the description may be too vague.`,
      suggestions: [
        'Try a more specific descriptor (e.g., "login button" instead of "login")',
        'Check if the page is still loading — add a "wait 2" step before this action',
        'Enable AI mode with --ai to try smart element finding',
        'Run with --headed to watch the page visually',
      ],
    };
  }

  // Element disabled
  if (raw.includes('disabled') || raw.includes('is not enabled')) {
    return {
      technical: raw.split('\n')[0],
      plain: `The element exists but is disabled. Form validation or loading state may be blocking it.`,
      suggestions: [
        'Add a "wait 2" step before this action',
        'Fill all required fields first',
        'Check if a modal or overlay is blocking interaction',
      ],
    };
  }

  // Timeout
  if (raw.includes('Timeout') || raw.includes('timeout')) {
    return {
      technical: raw.split('\n')[0],
      plain: `The action timed out. The element exists but did not become actionable within the timeout.`,
      suggestions: [
        'The page is likely slow to respond',
        'Add "wait 3" before the failing action',
        'Enable AI mode for smart waits',
        'Check network tab in --headed mode',
      ],
    };
  }

  // Navigation failed
  if (raw.includes('net::ERR') || raw.includes('navigation')) {
    return {
      technical: raw.split('\n')[0],
      plain: `Navigation to the URL failed. The page may be unreachable or returning an error.`,
      suggestions: [
        'Verify the URL is correct and accessible',
        'Check your internet connection',
        'Try the URL in a regular browser first',
      ],
    };
  }

  // Generic
  return {
    technical: raw.split('\n')[0],
    plain: `An error occurred during step execution.`,
    suggestions: [
      'Run with --verbose to see full details',
      'Run with --headed to watch the browser',
      'Try with --no-ai to isolate the issue',
    ],
  };
}
