// Maps each action to a Playwright code line for --save export

export function generateCodeLine(step, index) {
  const comment = `  // Step ${index + 1}: ${step.raw}`;

  switch (step.action) {
    case 'goto':
      return `${comment}\n  await page.goto('${step.url}');`;

    case 'click':
      return `${comment}\n  await ${selectorToCode(step.selector)}.click();`;

    case 'dblclick':
      return `${comment}\n  await ${selectorToCode(step.selector)}.dblclick();`;

    case 'rightclick':
      return `${comment}\n  await ${selectorToCode(step.selector)}.click({ button: 'right' });`;

    case 'type':
      if (step.selector) {
        return `${comment}\n  await ${selectorToCode(step.selector)}.fill('${escape(step.value)}');`;
      }
      return `${comment}\n  await page.locator('input:visible, textarea:visible').first().fill('${escape(step.value)}');`;

    case 'press':
      return `${comment}\n  await page.keyboard.press('${step.key}');`;

    case 'select':
      if (step.selector) {
        return `${comment}\n  await ${selectorToCode(step.selector)}.selectOption('${escape(step.value)}');`;
      }
      return `${comment}\n  await page.locator('select:visible').first().selectOption('${escape(step.value)}');`;

    case 'hover':
      return `${comment}\n  await ${selectorToCode(step.selector)}.hover();`;

    case 'scroll':
      if (step.direction === 'top') {
        return `${comment}\n  await page.evaluate(() => window.scrollTo(0, 0));`;
      }
      if (step.direction === 'bottom') {
        return `${comment}\n  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`;
      }
      return `${comment}\n  await page.evaluate(() => window.scrollBy(0, 500));`;

    case 'wait':
      return `${comment}\n  await page.waitForTimeout(${step.duration});`;

    case 'assert':
      return `${comment}\n  ${assertionToCode(step.assertion)}`;

    case 'screenshot':
      return `${comment}\n  await page.screenshot({ path: 'runly-screenshot-${Date.now()}.png', fullPage: true });`;

    case 'upload':
      return `${comment}\n  await page.locator('input[type="file"]').setInputFiles('${escape(step.filepath)}');`;

    case 'accept':
      return `${comment}\n  page.on('dialog', dialog => dialog.accept());`;

    case 'dismiss':
      return `${comment}\n  page.on('dialog', dialog => dialog.dismiss());`;

    case 'clear':
      return `${comment}\n  await ${selectorToCode(step.selector)}.clear();`;

    case 'focus':
      return `${comment}\n  await ${selectorToCode(step.selector)}.focus();`;

    case 'drag':
      return `${comment}\n  await ${selectorToCode(step.source)}.dragTo(${selectorToCode(step.target)});`;

    case 'back':
      return `${comment}\n  await page.goBack();`;

    case 'forward':
      return `${comment}\n  await page.goForward();`;

    case 'reload':
      return `${comment}\n  await page.reload();`;

    default:
      return `${comment}\n  // Unknown action: ${step.action}`;
  }
}

// ── Selector descriptor → Playwright code string ────────────────

function selectorToCode(selector) {
  if (!selector) return "page.locator('body')";

  switch (selector.strategy) {
    case 'css':
      return `page.locator('${escape(selector.value)}')`;

    case 'xpath':
      return `page.locator('xpath=${escape(selector.value)}')`;

    case 'role': {
      const opts = selector.name ? `, { name: /${escape(selector.name)}/i }` : '';
      return `page.getByRole('${selector.role}'${opts})`;
    }

    case 'text':
      return `page.getByText('${escape(selector.value)}')`;

    default:
      return `page.getByText('${escape(selector.value || '')}')`;
  }
}

// ── Assertion → Playwright expect code ──────────────────────────

function assertionToCode(assertion) {
  if (!assertion) return '// No assertion';

  switch (assertion.type) {
    case 'visible':
      return `await expect(${selectorToCode(assertion.target)}).toBeVisible();`;

    case 'hidden':
      return `await expect(${selectorToCode(assertion.target)}).toBeHidden();`;

    case 'disabled':
      return `await expect(${selectorToCode(assertion.target)}).toBeDisabled();`;

    case 'enabled':
      return `await expect(${selectorToCode(assertion.target)}).toBeEnabled();`;

    case 'checked':
      return `await expect(${selectorToCode(assertion.target)}).toBeChecked();`;

    case 'url-contains':
      return `await expect(page).toHaveURL(/${escape(assertion.value)}/);`;

    case 'url-equals':
      return `await expect(page).toHaveURL('${escape(assertion.value)}');`;

    case 'title':
      return `await expect(page).toHaveTitle(/${escape(assertion.value)}/i);`;

    case 'count':
      return `await expect(${selectorToCode(assertion.target)}).toHaveCount(${assertion.count});`;

    case 'value':
      return `await expect(${selectorToCode(assertion.target)}).toHaveValue('${escape(assertion.value)}');`;

    case 'text-contains':
      return `await expect(page.getByText('${escape(assertion.value)}')).toBeVisible();`;

    default:
      return `// Unknown assertion: ${assertion.type}`;
  }
}

// ── Escape single quotes in strings ─────────────────────────────

function escape(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}
