const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.IMMICH_ENCRYPTION_KEY || '', 'hex');

if (KEY.length !== 32 && process.env.IMMICH_ENCRYPTION_KEY) {
  throw new Error('IMMICH_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Generate with: openssl rand -hex 32');
}

exports.encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
};

exports.decrypt = (encrypted) => {
  const parts = encrypted.split(':');
  if (parts.length !== 3) return encrypted; // Fallback for legacy plaintext
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    return encrypted; // Fallback for legacy plaintext
  }
};
