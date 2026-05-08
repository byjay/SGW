const fs = require('fs'), path = require('path'), crypto = require('crypto');
const KEY = path.join(__dirname, '..', '_keys', 'swgs.pem');
if (!fs.existsSync(KEY)) { console.error('키 없음:', KEY); process.exit(1); }
const key = crypto.createPrivateKey(fs.readFileSync(KEY, 'utf8'));
const der = crypto.createPublicKey(key).export({ type: 'spki', format: 'der' });
const hash = crypto.createHash('sha256').update(der).digest('hex');
let id = ''; for (const c of hash.substring(0, 32)) id += String.fromCharCode(97 + parseInt(c, 16));
console.log('Seastar GW Extension ID:', id);
console.log('SHA256:', hash);
fs.writeFileSync(path.join(__dirname, '_build', 'extension-id.txt'), id);
