import { writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { parse } from '../parser/index.js';
import { parseWithAI } from '../ai/parser.js';
import { isAIAvailable } from '../ai/client.js';
import { generate } from '../generator/index.js';
import { runSteps, runUrl } from '../runner/index.js';
import { reportResult, saveReport } from '../reporter/index.js';
import { saveLastRun } from '../utils/config.js';
import { getSpecPath } from '../utils/paths.js';

export async function testCommand(instruction, options) {
  logger.banner();

  // Step 1: Parse the instruction (AI if available, regex fallback)
  const aiAvailable = isAIAvailable() && options.ai !== false;

  if (aiAvailable && options.verbose) {
    logger.dim('  AI mode enabled (Claude)');
  }

  const steps = aiAvailable
    ? await parseWithAI(instruction, options)
    : parse(instruction);

  if (!steps || steps.length === 0) {
    const url = resolveUrl(instruction);
    logger.info(`No actions parsed — treating as URL: ${url}`);
    const spinner = logger.spinner('Launching browser...');

    const result = await runUrl(url, options);
    spinner.stop();
    reportResult(result);
    saveReport(result, instruction);
    await saveLastRun({ instruction, url, options });
    if (!result.success) process.exit(1);
    return;
  }

  logger.info(`Parsed ${steps.length} step(s) from: "${instruction}"`);
  if (options.verbose) {
    steps.forEach((s, i) => logger.step(i + 1, s.raw));
    console.log('');
  }

  if (options.save) {
    const code = generate(steps, { rawInput: instruction, headless: !options.headed });
    const specPath = getSpecPath(instruction.split(' ').slice(0, 4).join('-'));
    writeFileSync(specPath, code);
    logger.success(`Saved: ${specPath}`);
  }

  const spinner = logger.spinner('Running test...');

  try {
    const result = await runSteps(steps, options);
    spinner.stop();
    reportResult(result);
    saveReport(result, instruction);
    await saveLastRun({ instruction, options });
    if (!result.success) process.exit(1);
  } catch (err) {
    spinner.fail('Test crashed');
    logger.error(err.message);
    if (options.verbose) console.error(err.stack);
    process.exit(1);
  }
}

function resolveUrl(input) {
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  if (input.includes('.')) return `https://${input}`;
  return `https://${input}.com`;
}
