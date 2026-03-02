# 大文件上传性能测试

## 如何测试性能改进

### 准备测试文件

```bash
# 创建 1MB 的测试 JSON 文件
node -e "const obj = { data: Array(100000).fill({name: 'test', value: 123, nested: {deep: true}}) }; console.log(JSON.stringify(obj))" > test_1mb.json

# 创建 10MB 的测试 JSON 文件  
node -e "const obj = { data: Array(1000000).fill({name: 'test', value: 123, nested: {deep: true}}) }; console.log(JSON.stringify(obj))" > test_10mb.json
```

### 测试步骤

1. **打开应用**
   ```bash
   npm run dev
   ```

2. **上传大文件**
   - 上传 test_1mb.json，观察加载时间和 UI 响应
   - 上传 test_10mb.json，观察是否正常加载

3. **检查开发者工具**
   - 打开 Chrome DevTools → Performance 标签
   - 点击录制，然后上传文件
   - 停止录制，查看主线程阻塞情况
   - **优化后**：主线程不应有长时间阻塞

4. **测试功能**
   - ✅ 修改某个值，预览实时更新
   - ✅ 搜索内容，预览高亮显示
   - ✅ 点击"下一处"快速导航
   - ✅ 勾选"只显示修改"快速过滤
   - ✅ 导出 JSON 文件正常下载

### 性能指标

观察浏览器控制台中的时间指标：

```javascript
// 在控制台运行这个脚本来测试
console.time('file-upload');
// 上传文件
console.timeEnd('file-upload');

console.time('tree-filter');
// 在搜索框输入内容
console.timeEnd('tree-filter');
```

### 预期结果

| 操作 | 100KB | 1MB | 10MB |
|-----|--------|------|-------|
| 上传 & 解析 | < 50ms | < 300ms | < 2000ms |
| 树过滤 | < 10ms | < 50ms | < 200ms |
| 预览搜索 | < 20ms | < 100ms | < 500ms |
| 导出 | 立即完成 | 立即完成 | 立即完成 |

### 如果还是卡顿

1. **检查浏览器版本**（需要 structuredClone 支持）
2. **检查网络**（如果从远程服务器读取）
3. **检查系统资源**（RAM、CPU 占用）

## 优化详情

详见 `OPTIMIZATION.md` 文件


