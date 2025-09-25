import path from 'node:path';

export const CONFIG_PATH = path.join(process.cwd(), 'langnostic.config.json');
export const RUNS_PATH = path.join(process.cwd(), '.langnostic', 'runs');
