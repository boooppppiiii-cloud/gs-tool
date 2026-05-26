# GS 自动数据采集爬虫

每天 **09:00** 和 **18:00** 自动从 GM 后台抓取聊天和充值数据，调用 AI 生成日报，直接写入云端。组员刷新首页即可看到新记录，无需手动上传。

---

## 快速上手

### 1. 安装依赖

```bash
cd crawler
npm install
npx playwright install chromium
```

### 2. 配置环境变量

```bash
cp .env.crawler.example .env.crawler
```

打开 `.env.crawler` 填入：

| 变量 | 说明 |
|------|------|
| `GM_URL` | GM 后台网址，如 `https://gm.example.com` |
| `GM_USERNAME` | GM 后台登录账号 |
| `GM_PASSWORD` | GM 后台登录密码 |
| `GM_CHAT_PATH` | 聊天记录页面路径，如 `/chat/history` |
| `GM_RECHARGE_PATH` | 充值记录页面路径，如 `/recharge/list` |
| `GS_USER_ID` | 你的 App 用户 ID（在 App 控制台可查到，格式如 `abc123`） |
| `GS_GROUP` | 你的分组，如 `杭州三组` |
| `APP_SERVER_URL` | App 后端地址，本机跑填 `http://localhost:3000` |

### 3. 适配 GM 后台选择器（必须）

打开 `gmClient.ts`，搜索 `TODO`，共 4 处需要修改：

1. **登录表单** — 用户名输入框、密码输入框、登录按钮的 CSS 选择器
2. **聊天记录页** — 开始时间、结束时间输入框，查询按钮，导出按钮
3. **充值记录页** — 时间输入框，查询按钮，下一页按钮

**如何找选择器：**
1. 在浏览器中打开 GM 后台，按 F12 打开 DevTools
2. 点击 Elements 面板左上角的"选取元素"按钮
3. 点击页面上的目标元素，查看右侧 HTML
4. 右键元素 → Copy → Copy selector

如果充值表格的列顺序与默认不同，还需修改 `parser.ts` 中的 `RECHARGE_COL_MAP`。

### 4. 测试运行

确保 App 后端已启动（`npm run dev`），然后：

```bash
# 立即运行一次（不等定时）
npm run now

# 或用 ts-node 直接运行
npx ts-node index.ts --now
```

检查输出，确认日志无报错，再去 App 首页查看新生成的日报。

### 5. 启动定时任务

#### 方式 A：前台运行（测试用）

```bash
npm start
```

保持终端开着，09:00 和 18:00 会自动触发。

#### 方式 B：后台守护进程（推荐生产用）

```bash
npm install -g pm2
pm2 start dist/index.js --name gs-crawler
pm2 save
pm2 startup   # 设置开机自启
```

#### 方式 C：Windows 任务计划程序

1. 搜索"任务计划程序"并打开
2. 创建基本任务 → 设置每天 09:00 触发
3. 操作：启动程序 → `node`，参数：`e:\AI工具\26.05.07\crawler\dist\index.js --now`
4. 重复以上步骤创建 18:00 的任务

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `config.ts` | 读取 `.env.crawler` 环境变量 |
| `gmClient.ts` | Playwright 浏览器自动化，登录 + 下载 + 抓取 |
| `parser.ts` | Excel → ChatRecord[]，HTML 表格行 → RechargeRecord[] |
| `autoAnalysis.ts` | 调用 Gemini API 分析，写入 CloudBase |
| `index.ts` | 定时调度入口，串联整个流程 |

---

## 常见问题

**Q: 登录有验证码怎么办？**
A: 先将 `gmClient.ts` 中 `headless: true` 改为 `false`，让浏览器可见，手动完成验证码后爬虫继续。或咨询 GM 后台管理员获取免验证码的 API 账号。

**Q: 导出的 Excel 列顺序和默认不一样？**
A: 下载一份样本文件，用 Excel 查看实际列顺序，然后修改 `gmClient.ts` 中 `exportChatRecords` 的解析逻辑，或直接调整 `parser.ts` 中的列映射。

**Q: 充值表格列顺序不对？**
A: 修改 `parser.ts` 顶部的 `RECHARGE_COL_MAP`，把每个字段对应到正确的列索引（0 开始）。

**Q: App 后端没跑，能独立运行吗？**
A: 目前爬虫通过 `http://localhost:3000` 的代理调用 Gemini 和 CloudBase，所以需要后端在线。如果后端部署在服务器上，修改 `.env.crawler` 的 `APP_SERVER_URL` 为服务器地址即可。
