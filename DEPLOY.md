# JSON 编辑器 - 部署指南

## 方案一：Vercel (推荐 - 最简单)

### 步骤：
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub/GitLab 账号登录
3. 点击 "Add New Project"
4. 导入这个项目或上传 `dist` 目录
5. 点击 Deploy，几秒钟后获得公开链接

**优势**：
- 完全免费
- 自动 HTTPS
- 全球 CDN 加速
- 支持自定义域名

---

## 方案二：Netlify

### 步骤：
1. 访问 [netlify.com](https://netlify.com)
2. 注册/登录账号
3. 拖拽 `dist` 文件夹到页面
4. 自动部署完成，获得链接

**优势**：
- 免费托管
- 拖拽部署，极简单
- 自动 HTTPS

---

## 方案三：GitHub Pages

### 步骤：
1. 创建 GitHub 仓库
2. 推送代码到仓库
3. 在仓库 Settings → Pages 设置：
   - Source: Deploy from a branch
   - Branch: main → /dist
4. 访问 `https://<username>.github.io/<repo>/`

**配置调整**（如使用 GitHub Pages）：
需要修改 `vite.config.js`：
```js
export default defineConfig({
  plugins: [react()],
  base: '/<你的仓库名>/', // 例如 '/json-editor/'
})
```
然后重新 `npm run build`

---

## 方案四：直接分享文件（局域网）

### 快速启动服务器：
```bash
cd dist
python3 -m http.server 8080
# 或
npx serve -s .
```

然后分享给同局域网用户：`http://你的IP:8080`

**优势**：
- 无需注册账号
- 局部分享（适合内网）

**劣势**：
- 需要保持终端运行
- 仅局域网可访问

---

## 方案五：阿里云 OSS / 腾讯云 COS

### 步骤：
1. 开通对象存储服务
2. 创建 Bucket（公共读权限）
3. 上传 `dist` 目录内所有文件
4. 配置静态网站托管
5. 获得访问域名

**优势**：
- 国内访问快
- 可绑定自定义域名
- 稳定可靠

**成本**：
- 存储费用极低（几毛钱/月）
- 流量费用（按使用量）

---

## 推荐方案对比

| 方案 | 难度 | 成本 | 速度 | 适用场景 |
|------|------|------|------|----------|
| Vercel | ⭐ | 免费 | 快 | 公开分享（国外） |
| Netlify | ⭐ | 免费 | 快 | 公开分享 |
| GitHub Pages | ⭐⭐ | 免费 | 中 | 开源项目 |
| 局域网 | ⭐ | 免费 | 快 | 内网临时分享 |
| 云存储 | ⭐⭐⭐ | 付费 | 快 | 企业正式使用 |

---

## 当前构建产物

已生成的 `dist` 目录包含：
- `index.html` - 入口文件
- `assets/` - JS/CSS 资源（已压缩优化）

直接上传这些文件到任何静态托管服务即可。

---

## 快速测试本地构建

```bash
npx serve -s dist
```

访问 `http://localhost:3000` 查看生产版本

