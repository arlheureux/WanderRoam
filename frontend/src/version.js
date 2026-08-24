import { version } from '../package.json';

export const VERSION = version;
export const GIT_COMMIT = process.env.REACT_APP_GIT_COMMIT || 'unknown';
