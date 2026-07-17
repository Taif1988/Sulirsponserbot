// التحقق من أن بيانات initData القادمة من تطبيق تلكرام المصغّر (Mini App) حقيقية
// وليست مزوّرة، حسب الطريقة الرسمية من توثيق تلكرام:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

const crypto = require('crypto');

function verifyInitData(initData, botToken) {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckArr = [];
  for (const [key, value] of [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    return null; // البيانات غير صحيحة أو مزوّرة
  }

  const userStr = params.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr); // { id, first_name, username, ... }
  } catch {
    return null;
  }
}

module.exports = { verifyInitData };
