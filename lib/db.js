// طبقة تخزين بسيطة تعتمد على ملف JSON
// كافية لبداية المشروع (MVP). لاحقاً إذا كبر المشروع يفضل الانتقال لقاعدة بيانات حقيقية.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

const DEFAULT_DATA = {
  categories: [
    { id: 'jobs', label: 'وظائف' },
    { id: 'electronics', label: 'إلكترونيات' },
    { id: 'furniture', label: 'أثاث' },
    { id: 'vehicles', label: 'سيارات ومركبات' },
    { id: 'realestate', label: 'عقارات' },
    { id: 'other', label: 'أخرى' }
  ],
  ads: []
};

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
