require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const { readDb, writeDb } = require('./lib/db');
const { verifyInitData } = require('./lib/telegramAuth');

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.APP_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('❌ خطأ: لازم تحط BOT_TOKEN بملف .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const bot = new Telegraf(BOT_TOKEN);

// ------------------- أوامر البوت -------------------

bot.start((ctx) => {
  const db = readDb();
  const exists = db.users.find((u) => u.id === ctx.from.id);
  if (!exists) {
    db.users.push({
      id: ctx.from.id,
      username: ctx.from.username || null,
      firstName: ctx.from.first_name || ''
    });
    writeDb(db);
  }

  ctx.reply(
    'أهلاً بيك 👋\nهذا بوت إعلانات الوظائف والبيع.\nاضغط الزر تحت لفتح التطبيق:',
    Markup.inlineKeyboard([
      Markup.button.webApp('📋 فتح التطبيق', APP_URL)
    ])
  );
});

bot.launch();
console.log('✅ البوت شغال...');

// ------------------- أدوات مساعدة -------------------

function requireTelegramUser(req, res, next) {
  const initData = req.body.initData || req.query.initData;
  const user = verifyInitData(initData, BOT_TOKEN);
  if (!user) {
    return res.status(401).json({ error: 'بيانات تلكرام غير صالحة' });
  }
  req.tgUser = user;
  next();
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'دخول غير مصرح' });
  }
  next();
}

async function broadcastNewAd(ad) {
  const db = readDb();
  const typeLabel = ad.type === 'job' ? 'وظيفة جديدة 💼' : 'إعلان بيع جديد 🛍️';
  const message = `📢 ${typeLabel}\n\n*${ad.title}*\n${ad.price ? `💰 ${ad.price}\n` : ''}\nافتح التطبيق للاطلاع على التفاصيل.`;

  for (const user of db.users) {
    if (user.id === ad.posterId) continue;
    try {
      await bot.telegram.sendMessage(user.id, message, { parse_mode: 'Markdown' });
    } catch (e) {
      // المستخدم ممكن يكون سكر البوت أو حظره، نتجاهل ونكمل
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

// ------------------- API: الإعلانات (عامة) -------------------

app.get('/api/ads', (req, res) => {
  const db = readDb();
  const { type, q } = req.query;

  let ads = db.ads.filter((ad) => ad.status === 'approved');

  if (type) ads = ads.filter((ad) => ad.type === type);
  if (q) {
    const query = q.trim().toLowerCase();
    ads = ads.filter(
      (ad) =>
        ad.title.toLowerCase().includes(query) ||
        ad.description.toLowerCase().includes(query) ||
        (ad.price && ad.price.toLowerCase().includes(query))
    );
  }

  ads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(ads);
});

app.post('/api/ads', requireTelegramUser, (req, res) => {
  const { type, title, description, price, image } = req.body;

  if (!type || !title || !description) {
    return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة' });
  }

  const db = readDb();
  const newAd = {
    id: uuidv4(),
    type,
    title,
    description,
    price: price || null,
    image: image || null,
    posterId: req.tgUser.id,
    posterUsername: req.tgUser.username || null,
    posterName: req.tgUser.first_name || 'مستخدم',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.ads.push(newAd);
  writeDb(db);

  if (ADMIN_TELEGRAM_ID) {
    bot.telegram
      .sendMessage(
        ADMIN_TELEGRAM_ID,
        `📢 إعلان جديد بانتظار المراجعة:\n\n*${newAd.title}*\n${newAd.description}\n\nافتح لوحة التحكم للمراجعة.`,
        { parse_mode: 'Markdown' }
      )
      .catch((e) => console.error('فشل إرسال إشعار الأدمن:', e.message));
  }

  res.json({ success: true, ad: newAd });
});

app.get('/api/my-ads', requireTelegramUser, (req, res) => {
  const db = readDb();
  const myAds = db.ads
    .filter((ad) => ad.posterId === req.tgUser.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(myAds);
});

app.delete('/api/ads/:id', requireTelegramUser, (req, res) => {
  const db = readDb();
  const ad = db.ads.find((a) => a.id === req.params.id);
  if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });
  if (ad.posterId !== req.tgUser.id) {
    return res.status(403).json({ error: 'غير مصرح لك بحذف هذا الإعلان' });
  }
  db.ads = db.ads.filter((a) => a.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// ------------------- API: لوحة تحكم الأدمن -------------------

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }
  res.json({ token: ADMIN_PASSWORD });
});

app.get('/api/admin/ads', requireAdmin, (req, res) => {
  const db = readDb();
  const status = req.query.status || 'pending';
  const ads = db.ads
    .filter((ad) => ad.status === status)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(ads);
});

app.post('/api/admin/ads/:id/approve', requireAdmin, (req, res) => {
  const db = readDb();
  const ad = db.ads.find((a) => a.id === req.params.id);
  if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });

  ad.status = 'approved';
  writeDb(db);

  bot.telegram
    .sendMessage(ad.posterId, `✅ تم قبول إعلانك "${ad.title}" وهو الآن ظاهر للجميع.`)
    .catch((e) => console.error('فشل إشعار المستخدم:', e.message));

  broadcastNewAd(ad).catch((e) => console.error('فشل الإشعار الجماعي:', e.message));

  res.json({ success: true });
});

app.post('/api/admin/ads/:id/reject', requireAdmin, (req, res) => {
  const db = readDb();
  const ad = db.ads.find((a) => a.id === req.params.id);
  if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });

  ad.status = 'rejected';
  writeDb(db);

  bot.telegram
    .sendMessage(ad.posterId, `❌ للأسف تم رفض إعلانك "${ad.title}". تأكد أنه يطابق شروط النشر وحاول مرة أخرى.`)
    .catch((e) => console.error('فشل إشعار المستخدم:', e.message));

  res.json({ success: true });
});

// ------------------- تشغيل الخادم -------------------

app.listen(PORT, () => {
  console.log(`✅ الخادم شغال على المنفذ ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
