const levels = ['error', 'warn', 'info', 'debug'];
const configuredLevel = process.env.LOG_LEVEL || 'info';
const configuredIndex = levels.indexOf(configuredLevel);
const activeLevelIndex = configuredIndex === -1 ? levels.indexOf('info') : configuredIndex;

const formatMeta = (meta) => {
  if (meta === undefined || meta === null) return '';
  if (meta instanceof Error) {
    return ` ${meta.stack || meta.message}`;
  }
  if (typeof meta === 'string') return ` ${meta}`;
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (error) {
    return ` ${String(meta)}`;
  }
};

const write = (level, message, meta) => {
  const levelIndex = levels.indexOf(level);
  if (levelIndex > activeLevelIndex) return;

  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${level.toUpperCase()}: ${message}${formatMeta(meta)}`;

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
};

module.exports = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};
