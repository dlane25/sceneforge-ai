import { runStartupCheck } from './startup-check-lib.mjs';

if (!runStartupCheck()) process.exit(1);
