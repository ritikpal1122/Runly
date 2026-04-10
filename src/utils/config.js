import { homedir } from 'os';
import { join } from 'path';
import fse from 'fs-extra';

const CONFIG_DIR = join(homedir(), '.runly');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const LAST_RUN_FILE = join(CONFIG_DIR, 'last-run.json');
const SESSIONS_DIR = join(CONFIG_DIR, 'sessions');

export async function ensureConfigDir() {
  await fse.ensureDir(CONFIG_DIR);
  await fse.ensureDir(SESSIONS_DIR);
}

export async function readConfig() {
  try {
    return await fse.readJson(CONFIG_FILE);
  } catch {
    return {};
  }
}

export async function writeConfig(data) {
  await ensureConfigDir();
  await fse.writeJson(CONFIG_FILE, data, { spaces: 2 });
}

export async function saveLastRun(metadata) {
  await ensureConfigDir();
  await fse.writeJson(LAST_RUN_FILE, { ...metadata, timestamp: Date.now() }, { spaces: 2 });
}

export async function getLastRun() {
  try {
    return await fse.readJson(LAST_RUN_FILE);
  } catch {
    return null;
  }
}

export function getSessionPath(domain) {
  return join(SESSIONS_DIR, `${domain}.json`);
}

export { CONFIG_DIR, SESSIONS_DIR };
