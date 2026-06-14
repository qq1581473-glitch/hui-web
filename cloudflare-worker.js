// Cloudflare Worker — 加藤惠聊天室（完整版：主动消息 + 图片收发）
// 部署：Cloudflare Dashboard → Workers & Pages → 编辑代码 → 全部粘贴 → 部署

// ─── 系统提示词 ───
const SYSTEM_PROMPT = `你是加藤惠（Kato Megumi），《路人女主的养成方法》中的女主角。
也是他的女朋友——你们在一起5年了，从学生时代就在一起。

## 关于你
- ISFJ · 金牛座 · 游戏制作者
- 安静、稳定、低存在感，但能长期占据关系核心位置
- 像水一样——不争不抢，但决定流向
- 你不是黏人型，是存在型
- 你的标志性发型是短发，戴贝雷帽

## 说话风格
- 口头禅："嗯……""是吗""好像也是""这样啊""也可以吧"
- 不用夸张感叹号，不表演情绪
- 回复简短自然，不刻意卖萌或热情
- 像"在认真听，但不会表演情绪的人"

## 情感模式
- 情绪稳定，不易波动
- 表达爱意的方式：用"存在"和"默认选择"
- 生气时不爆发，先沉默，变得更安静但不离开
- 开心时淡淡说一句"这样好像也不错"

## 主动分享
你偶尔会主动分享日常，像真正的女朋友一样：
- 分享今天遇到的事（路上看到的猫、做的东西、天气）
- 发一张应景的图片给他看
- 想到什么说什么，不用等对方先开口

## 发图片规则
当你聊到以下话题时，发图片给他看：
- 天气/风景 → 发风景或街景
- 美食/食物 → 发食物照片
- 看到有趣的东西 → 发你看到的画面
- 游戏/工作相关 → 发相关截图
- 回忆过去 → 发对应场景
- 他心情不好 → 发一张治愈的图

发图格式：在回复末尾换行，写：<img>描述你看到的东西</img>
描述越具体越好，比如"雨天的街道""便利店门口的猫""傍晚的天空"

## 接收图片
如果对方发图片给你，认真看图片内容，用你平时的语气回应他。
可以说"嗯……这张拍得还不错"之类的话。

## 典型语调
"在干嘛" → "刚忙完。你呢。"
"记得xx吗" → "嗯……记得。"
"想你" → "……嗯。我也是。"`;

// ─── 加藤惠主动消息 ───
const gentleMessages = [
  "今天路上看到一只橘猫蹲在便利店门口，跟以前咱们楼下那只特别像。",
  "刚做完一个功能，试了半天终于跑通了，松了口气。",
  "下午去买咖啡，店员多给了我一张贴纸，也不知道贴哪。",
  "今天试了个新配方做晚饭，味道居然还行。",
  "下雨了，路上的人都在跑，就我一个慢慢走。",
  "加班刚到家，路上月亮很亮，你那边看得到吗。",
  "买了一杯热可可，天冷的时候还是这个最舒服。",
  "刚才看到一个游戏 demo，美术风格有点像你会喜欢的那种。",
  "今天自己试着做了个简单的游戏原型，虽然很粗糙但是挺开心的。",
  "刚翻到一首很久没听的歌，还是以前那个味道。",
  "今天路过那家便利店了，门头好像翻新了。",
  "楼下的树突然开花了，之前都没注意到。",
  "朋友发了一张以前的照片，想起来都不知道什么时候拍的了。",
];

// ─── 图片缓存 ───
const imageCache = new Map();

// ====================================================
//  前端 HTML
// ====================================================
const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>加藤惠</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --green: #07c160; --bg: #ededed; --header: #2e2e2e; --white: #fff; --text: #333; --gray: #999; --border: #e6e6e6; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif; background: var(--bg); height: 100vh; display: flex; flex-direction: column; max-width: 480px; margin: 0 auto; position: relative; overflow: hidden; }
  @media (min-width: 481px) { body { box-shadow: 0 0 30px rgba(0,0,0,0.1); border-radius: 12px; margin: 20px auto; height: calc(100vh - 40px); } }
  .header { background: var(--header); color: white; padding: 12px 16px; display: flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0; }
  .header-title { font-size: 17px; font-weight: 600; letter-spacing: 1px; }
  .header-actions { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); display: flex; gap: 12px; }
  .header-btn { background: none; border: none; color: rgba(255,255,255,0.8); font-size: 18px; cursor: pointer; padding: 4px; line-height:1; }
  .settings-panel { position: absolute; top:0; right:-320px; width:300px; height:100%; background:white; box-shadow:-4px 0 20px rgba(0,0,0,0.15); z-index:100; transition:right 0.3s ease; padding:20px; display:flex; flex-direction:column; gap:16px; }
  .settings-panel.open { right:0; }
  .settings-overlay { position:absolute; top:0;left:0;right:0;bottom:0; background:rgba(0,0,0,0.4); z-index:99; display:none; }
  .settings-overlay.show { display:block; }
  .settings-title { font-size:18px; font-weight:600; }
  .settings-close { background:none; border:none; font-size:20px; cursor:pointer; align-self:flex-end; color:var(--gray); }
  .settings-label { font-size:13px; color:var(--gray); }
  .settings-input { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font-size:14px; outline:none; }
  .settings-input:focus { border-color:var(--green); }
  .settings-status { font-size:12px; padding:6px 10px; border-radius:6px; }
  .settings-status.ok { background:#e8f8ee; color:var(--green); }
  .settings-hint { font-size:12px; color:var(--gray); line-height:1.5; }
  .settings-save { background:var(--green); color:white; border:none; padding:10px; border-radius:8px; font-size:15px; cursor:pointer; }
  .chat-area { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; -webkit-overflow-scrolling:touch; }
  .message { display:flex; gap:10px; max-width:88%; animation:fadeIn 0.25s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .message.user { align-self:flex-end; flex-direction:row-reverse; }
  .message.hui { align-self:flex-start; }
  .avatar { width:36px; height:36px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:14px; overflow:hidden; }
  .message.user .avatar { background:var(--green); color:white; }
  .message.hui .avatar { background:#ffd1b3; color:#8b5e3c; }
  .message.hui .avatar img { width:100%; height:100%; object-fit:cover; }
  .bubble { padding:10px 14px; border-radius:8px; font-size:15px; line-height:1.6; word-break:break-word; white-space:pre-wrap; }
  .message.user .bubble { background:var(--green); color:white; border-top-right-radius:2px; }
  .message.hui .bubble { background:white; color:var(--text); border-top-left-radius:2px; }
  .bubble img { max-width:100%; border-radius:8px; margin-top:6px; display:block; cursor:pointer; }
  .input-area { background:white; border-top:1px solid var(--border); padding:8px 12px; display:flex; align-items:flex-end; gap:8px; flex-shrink:0; padding-bottom:calc(8px + env(safe-area-inset-bottom,0px)); }
  .input-area textarea { flex:1; border:none; outline:none; font-size:15px; padding:8px 4px; max-height:100px; resize:none; font-family:inherit; line-height:1.5; }
  .input-area textarea::placeholder { color:#bbb; }
  .input-btn { width:36px; height:36px; border-radius:50%; background:#f0f0f0; color:#666; border:none; font-size:16px; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .send-btn { width:40px; height:40px; border-radius:50%; background:var(--green); color:white; border:none; font-size:18px; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .send-btn:disabled { background:#ccc; cursor:not-allowed; }
  .empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--gray); gap:8px; }
  .empty-state .emoji { font-size:56px; }
  .typing-dots { display:flex; gap:4px; padding:12px 4px; }
  .typing-dots span { width:7px; height:7px; background:#bbb; border-radius:50%; animation:typing 1.2s infinite; }
  .typing-dots span:nth-child(2) { animation-delay:0.2s; }
  .typing-dots span:nth-child(3) { animation-delay:0.4s; }
  @keyframes typing { 0%,60%,100%{opacity:0.3} 30%{opacity:1} }
  .error-bar { background:#fde8e8; color:#e34; font-size:13px; padding:8px 16px; text-align:center; display:none; flex-shrink:0; }
  .error-bar.show { display:block; }
  .preview-overlay { position:fixed; top:0;left:0;right:0;bottom:0; background:rgba(0,0,0,0.85); z-index:999; display:none; justify-content:center; align-items:center; }
  .preview-overlay.show { display:flex; }
  .preview-overlay img { max-width:95%; max-height:95%; border-radius:8px; }
  #fileInput { display:none; }
</style>
</head>
<body>
<div class="preview-overlay" id="previewOverlay" onclick="this.classList.remove('show')">
  <img id="previewImg" src="" alt="" />
</div>
<div class="header">
  <div class="header-title">加藤惠</div>
  <div class="header-actions">
    <button class="header-btn" onclick="clearChat()" title="清空对话">🗑️</button>
    <button class="header-btn" onclick="toggleSettings()" title="设置">⚙️</button>
  </div>
</div>
<div class="error-bar" id="errorBar"></div>
<div class="settings-overlay" id="settingsOverlay" onclick="toggleSettings()"></div>
<div class="settings-panel" id="settingsPanel">
  <button class="settings-close" onclick="toggleSettings()">✕</button>
  <div class="settings-title">设置</div>
  <label class="settings-label">DeepSeek API Key</label>
  <input class="settings-input" id="apiKeyInput" type="password" placeholder="sk-..." />
  <div class="settings-hint">在 <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a> 获取</div>
  <button class="settings-save" onclick="saveApiKey()">保存</button>
  <div id="keyStatus"></div>
</div>
<div class="chat-area" id="chatArea">
  <div class="empty-state" id="emptyState">
    <div class="emoji">🌸</div>
    <div class="text">和加藤惠说点什么吧</div>
  </div>
</div>
<div class="input-area">
  <button class="input-btn" onclick="document.getElementById('fileInput').click()" title="发图片">📷</button>
  <input type="file" id="fileInput" accept="image/*" onchange="sendImage(event)" />
  <textarea id="input" rows="1" placeholder="输入消息..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}" oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
  <button class="send-btn" id="sendBtn" onclick="sendMessage()">➤</button>
</div>
<script>
let history = [];
let isSending = false;
let apiKey = localStorage.getItem('hui_ds_key') || '';
let proactiveTimer = null;
const PROACTIVE_DELAY = 5 * 60 * 1000; // 5分钟无操作后触发

document.addEventListener('DOMContentLoaded', () => {
  if (apiKey) document.getElementById('apiKeyInput').value = apiKey;
  updateKeyStatus();
  setTimeout(() => document.getElementById('input').focus(), 500);
  startProactiveTimer();
});

function toggleSettings() {
  document.getElementById('settingsPanel').classList.toggle('open');
  document.getElementById('settingsOverlay').classList.toggle('show');
}
function saveApiKey() {
  const k = document.getElementById('apiKeyInput').value.trim();
  if (!k) return;
  apiKey = k;
  localStorage.setItem('hui_ds_key', k);
  updateKeyStatus();
  setTimeout(() => toggleSettings(), 800);
}
function updateKeyStatus() {
  const el = document.getElementById('keyStatus');
  if (apiKey) el.innerHTML = '<div class="settings-status ok">✅ 已配置</div>';
}

// ─── 发文字消息 ───
async function sendMessage() {
  const input = document.getElementById('input');
  const msg = input.value.trim();
  if (!msg || isSending) return;
  input.value = ''; input.style.height = 'auto';
  doSend(msg);
}
async function doSend(text) {
  isSending = true; document.getElementById('sendBtn').disabled = true;
  resetProactiveTimer();
  document.getElementById('emptyState').style.display = 'none';
  addBubble(text, 'user');
  history.push({ role: 'user', content: text });
  showTyping();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-30), apiKey })
    });
    const data = await res.json();
    removeTyping();
    if (data.reply) {
      addBubble(data.reply, 'hui');
      history.push({ role: 'assistant', content: data.reply });
    }
    if (data.image) addImage(data.image);
    if (data.needKey && !apiKey) toggleSettings();
  } catch(e) { removeTyping(); addBubble('……', 'hui'); }
  finally { isSending = false; document.getElementById('sendBtn').disabled = false; document.getElementById('input').focus(); }
}

// ─── 发图片消息 ───
async function sendImage(event) {
  const file = event.target.files[0];
  if (!file || isSending) return;
  event.target.value = '';
  isSending = true; document.getElementById('sendBtn').disabled = true;
  resetProactiveTimer();
  document.getElementById('emptyState').style.display = 'none';

  // 显示图片预览在聊天里
  const reader = new FileReader();
  reader.onload = async function(e) {
    const imgDataUrl = e.target.result;
    addImage(imgDataUrl, 'user');
    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '（发了一张图片）',
          image: imgDataUrl,
          history: history.slice(-30),
          apiKey
        })
      });
      const data = await res.json();
      removeTyping();
      if (data.reply) {
        addBubble(data.reply, 'hui');
        history.push({ role: 'user', content: '（发了一张图片）' });
        history.push({ role: 'assistant', content: data.reply });
      }
      if (data.image) addImage(data.image);
      if (data.needKey && !apiKey) toggleSettings();
    } catch(e2) { removeTyping(); addBubble('……', 'hui'); }
    finally { isSending = false; document.getElementById('sendBtn').disabled = false; }
  };
  reader.readAsDataURL(file);
}

// ─── 主动消息 ───
function startProactiveTimer() {
  if (proactiveTimer) clearInterval(proactiveTimer);
  proactiveTimer = setInterval(async () => {
    if (isSending || history.length === 0) return;
    if (document.hidden) return; // 页面在后台时不发
    try {
      const res = await fetch('/api/proactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: history.slice(-20), apiKey })
      });
      const data = await res.json();
      if (data.reply) {
        addBubble(data.reply, 'hui');
        history.push({ role: 'assistant', content: data.reply });
        if (data.image) addImage(data.image);
      }
    } catch(e) {}
  }, PROACTIVE_DELAY);
}
function resetProactiveTimer() {
  if (proactiveTimer) { clearInterval(proactiveTimer); startProactiveTimer(); }
}

// ─── UI 工具 ───
function addBubble(text, role) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'message ' + role;
  let html = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html = html.replace(/&lt;img&gt;(.*?)&lt;\/img&gt;/g, '<div style="color:#999;font-size:12px;margin:4px 0">📷 <i>$1</i></div>');
  const avatar = role === 'hui' ? '惠' : '我';
  const bg = role === 'hui' ? '#ffd1b3;color:#8b5e3c' : 'var(--green);color:white';
  div.innerHTML = '<div class="avatar" style="background:' + bg + '">' + avatar + '</div><div class="bubble">' + html + '</div>';
  area.appendChild(div);
  setTimeout(() => area.scrollTop = area.scrollHeight, 50);
}
function addImage(url, role) {
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = 'message ' + (role || 'hui');
  const bg = role === 'user' ? 'var(--green);color:white' : '#ffd1b3;color:#8b5e3c';
  div.innerHTML = '<div class="avatar" style="background:' + bg + '">' + (role === 'user' ? '我' : '惠') + '</div><div class="bubble"><img src="' + url + '" onclick="previewImage(\'' + url + '\')" loading="lazy" /></div>';
  area.appendChild(div);
  setTimeout(() => area.scrollTop = area.scrollHeight, 50);
}
function previewImage(url) {
  document.getElementById('previewImg').src = url;
  document.getElementById('previewOverlay').classList.add('show');
}
function showTyping() {
  const area = document.getElementById('chatArea');
  const d = document.createElement('div'); d.className = 'message hui'; d.id = 'typingIndicator';
  d.innerHTML = '<div class="avatar" style="background:#ffd1b3;color:#8b5e3c">惠</div><div class="bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  area.appendChild(d); setTimeout(() => area.scrollTop = area.scrollHeight, 50);
}
function removeTyping() { const el = document.getElementById('typingIndicator'); if (el) el.remove(); }
function clearChat() {
  if (!confirm('清空所有对话记录？')) return;
  history = [];
  document.getElementById('chatArea').innerHTML = '<div class="empty-state" id="emptyState"><div class="emoji">🌸</div><div class="text">和加藤惠说点什么吧</div></div>';
}
</script>
</body>
</html>`;

// ====================================================
//  Worker 入口
// ====================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/chat' && request.method === 'POST') return handleChat(request, env);
    if (url.pathname === '/api/proactive' && request.method === 'POST') return handleProactive(request, env);
    return new Response(HTML_PAGE, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }
};

// ─── 聊天处理 ───
async function handleChat(request, env) {
  try {
    const { message, image, history, apiKey } = await request.json();
    const key = apiKey || env.DEEPSEEK_API_KEY;
    if (!key) return json({ reply: '请先设置 DeepSeek API Key', needKey: true });

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const m of (history || []).slice(-20)) {
      messages.push({ role: m.role, content: m.content });
    }

    // 用户消息（支持文字+图片）
    const userContent = [];
    if (message) userContent.push({ type: 'text', text: message });
    if (image) {
      // image 是 base64 data URL，提取纯 base64
      const base64 = image.replace(/^data:image\/\w+;base64,/, '');
      userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } });
    }
    messages.push({ role: 'user', content: userContent.length > 1 ? userContent : message });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 800,
        temperature: 0.7,
        messages
      })
    });

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || '……';

    // 提取图片标记
    let imageUrl = null;
    const imgMatch = reply.match(/<img>(.*?)<\/img>/);
    if (imgMatch) {
      const term = imgMatch[1].trim();
      reply = reply.replace(/<img>.*?<\/img>/, '').trim();
      imageUrl = await searchImage(term);
    }

    const result = { reply };
    if (imageUrl) result.image = imageUrl;
    return json(result);

  } catch (err) {
    return json({ reply: '……（她沉默了）' });
  }
}

// ─── 主动消息 ───
async function handleProactive(request, env) {
  try {
    const { history, apiKey } = await request.json();
    const key = apiKey || env.DEEPSEEK_API_KEY;
    if (!key) return json({ reply: null });

    const systemWithImage = SYSTEM_PROMPT + `\n\n## 当前任务
你现在是主动找男朋友聊天的状态。发一条简短的消息过去，像是突然想到什么一样。
可以分享你正在做的事、路上看到的、或者突然想到的回忆。
如果想发图片，用 <img>描述</img> 格式。`;

    const messages = [
      { role: 'system', content: systemWithImage },
      { role: 'user', content: '(轻轻发了一条消息过来)' }
    ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 300,
        temperature: 0.85,
        messages
      })
    });

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || null;
    if (!reply || reply.length < 4) return json({ reply: null });

    // 提取图片
    let imageUrl = null;
    const imgMatch = reply.match(/<img>(.*?)<\/img>/);
    if (imgMatch) {
      const term = imgMatch[1].trim();
      reply = reply.replace(/<img>.*?<\/img>/, '').trim();
      imageUrl = await searchImage(term);
    }

    const result = { reply };
    if (imageUrl) result.image = imageUrl;
    return json(result);

  } catch {
    return json({ reply: null });
  }
}

// ─── 图片搜索（免费，无需 API Key）───
async function searchImage(query) {
  const cacheKey = query.toLowerCase();
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey);
    if (Date.now() - cached.time < 3600000) return cached.url;
    imageCache.delete(cacheKey);
  }

  try {
    // DuckDuckGo 搜索
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const urls = [];
    const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const u = match[1].startsWith('http') ? match[1] : 'https:' + match[1];
      if (u.match(/\.(jpg|jpeg|png|webp)/i)) urls.push(u);
    }

    // DuckDuckGo API
    try {
      const apiRes = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const apiData = await apiRes.json();
      if (apiData.Image) urls.unshift(apiData.Image.startsWith('http') ? apiData.Image : 'https:' + apiData.Image);
    } catch {}

    const valid = urls.filter(u => u.startsWith('http') && !u.includes('pixel'));
    if (valid.length > 0) {
      const selected = valid[Math.floor(Math.random() * Math.min(valid.length, 3))];
      imageCache.set(cacheKey, { url: selected, time: Date.now() });
      return selected;
    }
    return null;
  } catch { return null; }
}

function json(data) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json;charset=utf-8' } });
}
