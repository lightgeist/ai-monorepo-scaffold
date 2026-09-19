#!/usr/bin/env node
import { configureAtlasCodeToolsChildEnvironment } from './atlascode-tools-environment.js';

configureAtlasCodeToolsChildEnvironment();
const embeddedEntry = new URL('./embedded/atlascode-tools/cli.mjs', import.meta.url);
await import(embeddedEntry.href);
