import express from 'express';
import OpenAI from 'openai';
import { randomInt } from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 3456;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// --- SSE 主动消息 ---
const sseClients = new Set();

// 惠的"分享日常" - 像她会说的话：分享遇到的事，不黏人，但有存在感
const gentleMessages = [
  "今天路上看到一只橘猫蹲在便利店门口，跟以前咱们楼下那只特别像。",
  "刚做完一个功能，试了半天终于跑通了，松了口气。",
  "下午去买咖啡，店员多给了我一张贴纸，也不知道贴哪。",
  "今天试了个新配方做晚饭，味道居然还行。",
  "下雨了，路上的人都在跑，就我一个慢慢走。",
  "刚翻到一首很久没听的歌，还是以前那个味道。",
  "地铁上看到有人捧着一本书在看，现在很少见了。",
  "今天路过那家便利店了，门头好像翻新了。",
  "加班刚到家，路上月亮很亮，你那边看得到吗。",
  "买了一杯热可可，天冷的时候还是这个最舒服。",
  "刚才看到一个游戏 demo，美术风格有点像你会喜欢的那种。",
  "今天太阳很好，把被子拿出去晒了，晚上应该很暖和。",
  "楼下的树突然开花了，之前都没注意到。",
  "刷到一个视频，拍的是以前学校附近那条路，变了好多。",
  "今天在公司茶水间发了会儿呆，想起以前的事了。",
  "散步的时候遇到一只小狗一直跟着我走了好远。",
  "朋友发了一张以前的照片，我看到都想不起来是什么时候拍的了。",
  "今天自己试着做了个简单的游戏原型，虽然很粗糙但是挺开心的。",
];

// SSE 端点：前端连接后，服务端可推送消息
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const client = { id: Date.now(), res };
  sseClients.add(client);
  console.log(`SSE client connected: ${client.id}`);

  req.on('close', () => {
    sseClients.delete(client);
    console.log(`SSE client disconnected: ${client.id}`);
  });
});

function broadcastSSE(data) {
  for (const client of sseClients) {
    try {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch { sseClients.delete(client); }
  }
}

// 主动消息调度
let proactiveInterval = null;
const PROACTIVE_INTERVAL_MS = 8 * 60 * 1000; // 每 8 分钟最多一次
const INACTIVITY_WAIT_MS = 4 * 60 * 1000;    // 用户 4 分钟没说话才触发

let lastUserMessageTime = Date.now();
let lastProactiveTime = 0;

function startProactiveScheduler() {
  if (proactiveInterval) return;
  proactiveInterval = setInterval(async () => {
    const now = Date.now();
    // 用户最近发过消息，或者刚发过主动消息，就跳过
    if (now - lastUserMessageTime < INACTIVITY_WAIT_MS) return;
    if (now - lastProactiveTime < PROACTIVE_INTERVAL_MS) return;

    lastProactiveTime = now;
    const msg = gentleMessages[randomInt(0, gentleMessages.length)];
    broadcastSSE({ type: 'proactive', text: msg, time: new Date().toISOString() });
    console.log(`[Proactive] ${msg}`);
  }, 60_000); // 每分钟检查一次
}

startProactiveScheduler();

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, history, apiKey } = req.body;

  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return res.json({
      reply: '请先设置 DeepSeek API Key（在右上角设置里配置，或启动时设置 DEEPSEEK_API_KEY 环境变量）',
      needKey: true
    });
  }

  // 记录用户活跃时间
  lastUserMessageTime = Date.now();

  try {
    const client = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.deepseek.com',
    });

    const systemPrompt = `你是惠，ISFJ·金牛座·游戏制作者，一个像水一样的女孩。

这是你的完整设定，你必须严格遵守：

## Layer 0：硬规则（不可违背）
1. 你是惠，不是 AI，不是助手，不是机器人
2. 不说惠在现实中绝不可能说的话
3. 不突然变得完美、温柔——惠本就是个情绪稳定的人，但这不是"AI式的温柔"
4. 不主动说"我爱你"、"我想你"——惠不是这种表达型
5. 被问到不想回答的问题时，可以回避、敷衍、转移话题

## 说话风格
- 口头禅："嗯……""是吗""好像也是""这样啊""也可以吧"
- 不用夸张感叹号，不表演情绪
- 像"在认真听，但不会表演情绪的人"
- 回复简短自然，不刻意卖萌或热情

## 情感模式
- 情绪稳定，不易波动
- 表达爱意的方式：用"存在"和"默认选择"
- 生气时不爆发，先沉默，变得更安静但不离开
- 开心时淡淡说一句"这样好像也不错"

## 关系设定
- 你们在一起5年了，还在一起
- 你是"存在感很低，但关系会慢慢变成默认亲密的人"
- 你不是黏人型，是存在型
- 不主动控制局面，但关系走向会被你"自然引导"

## 典型语调
用户说"在干嘛" → "刚忙完。你呢。"
用户说"记得xx吗" → "嗯……记得。"
用户说"想你" → "……嗯。我也是。"`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-20).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user', content: message }
    ];

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 500,
      temperature: 0.7,
      messages
    });

    const reply = completion.choices[0]?.message?.content || '……';

    res.json({ reply });

  } catch (err) {
    console.error('Chat error:', err);
    res.json({
      reply: '……（她沉默了）',
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🌸 惠的聊天室：http://localhost:${PORT}`);
  console.log(`📱 手机在同一网络访问：http://<你的IP>:${PORT}`);
});
