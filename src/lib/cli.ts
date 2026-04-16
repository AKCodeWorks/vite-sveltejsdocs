#!/usr/bin/env node

import path from 'node:path';
import { loadUserConfig, startStandaloneDocsServer } from './cli-support.js';

const help = `sveltejsdoc

Usage:
	sveltejsdoc start [--root path] [--config path] [--scanDir path] [--port 5111] [--host 127.0.0.1]
`;

const args = process.argv.slice(2);
const command = args[0];

const readOption = (flag: string): string | undefined => {
	const index = args.indexOf(flag);
	if (index === -1) return undefined;
	return args[index + 1];
};

if (!command || command === 'help' || command === '--help' || command === '-h') {
	console.log(help);
	process.exit(0);
}

if (command !== 'start') {
	console.error(`[sveltejsdoc] Unknown command: ${command}`);
	console.log(help);
	process.exit(1);
}

const root = readOption('--root');
const configFile = readOption('--config');
const scanDir = readOption('--scanDir');
const port = readOption('--port');
const host = readOption('--host');

const resolvedRoot = root ? path.resolve(root) : process.cwd();
const fileConfig = await loadUserConfig(resolvedRoot, configFile ? path.resolve(configFile) : undefined);

await startStandaloneDocsServer({
	...fileConfig,
	root: resolvedRoot,
	scanDir: scanDir ? path.resolve(scanDir) : fileConfig.scanDir,
	port: port ? Number(port) : fileConfig.port,
	host: host ?? fileConfig.host,
	configFile: fileConfig.configFile
});