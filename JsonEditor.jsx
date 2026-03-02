import React, { useState, useEffect } from "react";
import { Tree, Input, Button, Modal, message, Upload, Typography } from "antd";
import { UploadOutlined, CopyOutlined } from "@ant-design/icons";

const { Title } = Typography;

// 优化的克隆函数，使用 structuredClone（支持较新浏览器）或回退到 JSON 方法
function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

// 限制递归深度，避免深层对象导致性能问题
const MAX_TREE_DEPTH = 50;
const MAX_ARRAY_ITEMS = 1000;

function buildTreeData(obj, path = [], depth = 0) {
  // 深度限制和大数组限制
  if (depth >= MAX_TREE_DEPTH) {
    return [];
  }

  if (Array.isArray(obj)) {
    // 大数组只显示前 MAX_ARRAY_ITEMS 个
    const slicedArr = obj.slice(0, MAX_ARRAY_ITEMS);
    const nodes = slicedArr.map((item, idx) => {
      const currentPath = [...path, idx];
      const pathStr = currentPath.join(".");

      // 为叶子节点显示值
      let title = `[${idx}]`;
      if (typeof item !== "object" || item === null) {
        const valueStr = JSON.stringify(item);
        title = `[${idx}]: ${valueStr}`;
      }

      return {
        title,
        key: pathStr,
        children: buildTreeData(item, currentPath, depth + 1),
        isLeaf: typeof item !== "object" || item === null,
        value: item,
        isArray: Array.isArray(item),
        isObject: typeof item === "object" && item !== null && !Array.isArray(item),
        path: currentPath
      };
    });

    // 如果有超过的元素，添加提示节点
    if (obj.length > MAX_ARRAY_ITEMS) {
      nodes.push({
        title: `... 还有 ${obj.length - MAX_ARRAY_ITEMS} 项`,
        key: `${[...path, 'more'].join('.')}`,
        children: [],
        isLeaf: true,
        disabled: true
      });
    }
    return nodes;
  } else if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).map(([k, v]) => {
      const currentPath = [...path, k];
      const pathStr = currentPath.join(".");

      // 为叶子节点显示值
      let title = k;
      if (typeof v !== "object" || v === null) {
        const valueStr = JSON.stringify(v);
        title = `${k}: ${valueStr}`;
      }

      return {
        title,
        key: pathStr,
        children: buildTreeData(v, currentPath, depth + 1),
        isLeaf: typeof v !== "object" || v === null,
        value: v,
        isArray: Array.isArray(v),
        isObject: typeof v === "object" && v !== null && !Array.isArray(v),
        path: currentPath
      };
    });
  } else {
    return [];
  }
}

function getValueByPath(obj, pathArr) {
  let current = obj;
  for (let i = 0; i < pathArr.length; i++) {
    const key = pathArr[i];
    const numKey = Number.isNaN(Number(key)) ? key : Number(key);
    current = current?.[numKey];
  }
  return current;
}

function setValueByPath(obj, pathArr, value) {
  if (pathArr.length === 0) return;
  let last = pathArr.pop();
  let parent = obj;
  for (let i = 0; i < pathArr.length; i++) {
    const key = pathArr[i];
    const numKey = Number.isNaN(Number(key)) ? key : Number(key);
    parent = parent[numKey];
  }
  const numLast = Number.isNaN(Number(last)) ? last : Number(last);
  parent[numLast] = value;
}

function deleteByPath(obj, pathArr) {
  if (pathArr.length === 0) return;
  let last = pathArr.pop();
  let parent = obj;
  for (let i = 0; i < pathArr.length; i++) {
    const key = pathArr[i];
    const numKey = Number.isNaN(Number(key)) ? key : Number(key);
    parent = parent[numKey];
  }
  const numLast = Number.isNaN(Number(last)) ? last : Number(last);
  if (Array.isArray(parent)) parent.splice(numLast, 1);
  else delete parent[numLast];
}

// 对比两个 JSON，找出所有修改的路径
function findChangedPaths(original, current, path = []) {
  const changes = new Set();

  // 如果类型不同，当前路径是修改
  if (typeof original !== typeof current) {
    changes.add(path.join('.'));
    return changes;
  }

  // 原始值不存在（新增）
  if (original === undefined || original === null) {
    changes.add(path.join('.'));
    return changes;
  }

  // 当前值不存在（删除）
  if (current === undefined || current === null) {
    changes.add(path.join('.'));
    return changes;
  }

  // 基本类型对比
  if (typeof original !== 'object') {
    if (original !== current) {
      changes.add(path.join('.'));
    }
    return changes;
  }

  // 数组对比
  if (Array.isArray(original) && Array.isArray(current)) {
    const maxLen = Math.max(original.length, current.length);
    for (let i = 0; i < maxLen; i++) {
      const subChanges = findChangedPaths(original[i], current[i], [...path, i]);
      subChanges.forEach(p => changes.add(p));
    }
    return changes;
  }

  // 对象对比
  if (typeof original === 'object' && typeof current === 'object') {
    const allKeys = new Set([...Object.keys(original), ...Object.keys(current)]);
    allKeys.forEach(key => {
      const subChanges = findChangedPaths(original[key], current[key], [...path, key]);
      subChanges.forEach(p => changes.add(p));
    });
    return changes;
  }

  return changes;
}

export default function JsonEditor() {
  const [json, setJson] = useState(null);
  const [originalJson, setOriginalJson] = useState(null); // 原始 JSON
  const [treeData, setTreeData] = useState([]);
  const [search, setSearch] = useState("");
  const [searchFilter, setSearchFilter] = useState(""); // 实际用于过滤树的搜索词
  const [selected, setSelected] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, path: [], value: "" });
  const [addModal, setAddModal] = useState({ open: false, path: [], key: "", value: "" });
  const [batchModal, setBatchModal] = useState({ open: false, matches: [], value: "", selectedMatches: new Set() });

  // 预览区搜索
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewSearchIndex, setPreviewSearchIndex] = useState(0);
  const [previewSearchMatches, setPreviewSearchMatches] = useState([]);

  // 文件上传状态
  const [isLoading, setIsLoading] = useState(false);

  // 只显示修改的内容 - 默认勾选
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);

  // 使用 requestIdleCallback 或 setTimeout 来异步处理
  const processFileAsync = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setIsLoading(true);
      // 使用微任务队列避免阻塞
      Promise.resolve().then(() => {
        try {
          const text = e.target.result;
          const data = JSON.parse(text);

          // 在下一个宏任务中处理树构建
          setTimeout(() => {
            const tree = buildTreeData(data);
            setJson(data);
            setOriginalJson(deepClone(data)); // 保存原始数据
            setTreeData(tree);
            message.success("文件加载成功");
            setIsLoading(false);
          }, 0);
        } catch (error) {
          message.error("JSON 格式错误");
          setIsLoading(false);
        }
      });
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  const handleFileUpload = (file) => {
    processFileAsync(file);
  };

  const handleSelect = (keys) => setSelected(keys);

  const handleEdit = () => {
    if (!selected.length) return;
    const pathArr = selected[0].split(".");
    const value = getValueByPath(json, pathArr);
    setEditModal({ open: true, path: pathArr, value: JSON.stringify(value) });
  };

  const handleEditOk = () => {
    try {
      const newJson = deepClone(json);
      const pathCopy = [...editModal.path];
      setValueByPath(newJson, pathCopy, JSON.parse(editModal.value));
      setJson(newJson);
      setTreeData(buildTreeData(newJson));
      setEditModal({ open: false, path: [], value: "" });
      message.success("修改成功");
    } catch (error) {
      message.error("值格式错误：" + error.message);
    }
  };

  const handleDelete = () => {
    if (!selected.length) return;
    Modal.confirm({
      title: "确认删除?",
      onOk: () => {
        const pathArr = selected[0].split(".");
        const newJson = deepClone(json);
        deleteByPath(newJson, [...pathArr]);
        setJson(newJson);
        setTreeData(buildTreeData(newJson));
        message.success("删除成功");
      }
    });
  };

  const handleAdd = () => {
    if (!selected.length) return;
    setAddModal({ open: true, path: selected[0].split("."), key: "", value: "" });
  };

  const handleAddOk = () => {
    try {
      const newJson = deepClone(json);

      // 处理路径中的数字索引
      let parent = newJson;
      for (let i = 0; i < addModal.path.length; i++) {
        const key = addModal.path[i];
        const numKey = Number.isNaN(Number(key)) ? key : Number(key);
        parent = parent[numKey];
      }

      let val = JSON.parse(addModal.value);
      if (Array.isArray(parent)) {
        parent.push(val);
      } else {
        parent[addModal.key] = val;
      }
      setJson(newJson);
      setTreeData(buildTreeData(newJson));
      setAddModal({ open: false, path: [], key: "", value: "" });
      message.success("新增成功");
    } catch {
      message.error("值格式错误");
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cfg.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(json, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      message.success("已复制到剪贴板");
    }).catch(() => {
      message.error("复制失败");
    });
  };

  // 收集所有匹配的叶子节点
  const collectMatchedLeaves = (nodes, searchTerm, matches = []) => {
    nodes.forEach(node => {
      const isMatch = node.title.includes(searchTerm);
      if (isMatch && node.isLeaf) {
        matches.push({ key: node.key, title: node.title });
      }
      if (node.children && node.children.length > 0) {
        collectMatchedLeaves(node.children, searchTerm, matches);
      }
    });
    return matches;
  };

  const handleBatchEdit = () => {
    if (!search) {
      message.warning("请先输入搜索内容");
      return;
    }
    const matches = collectMatchedLeaves(treeData, search);
    if (matches.length === 0) {
      message.warning("没有找到匹配的叶子节点");
      return;
    }
    // 默认全选所有匹配项
    const selectedMatches = new Set(matches.map((_, idx) => idx));
    setBatchModal({ open: true, matches, value: "", selectedMatches });
  };

  const handleBatchEditOk = () => {
    try {
      const newJson = deepClone(json);
      let newValue = JSON.parse(batchModal.value);

      // 只修改被选中的项
      batchModal.matches.forEach((match, idx) => {
        if (batchModal.selectedMatches.has(idx)) {
          const pathArr = match.key.split(".");
          setValueByPath(newJson, [...pathArr], newValue);
        }
      });

      setJson(newJson);
      setTreeData(buildTreeData(newJson));
      const selectedCount = batchModal.selectedMatches.size;
      setBatchModal({ open: false, matches: [], value: "", selectedMatches: new Set() });
      message.success(`批量修改成功，共修改 ${selectedCount} 个字段`);
    } catch {
      message.error("值格式错误");
    }
  };

  const filterTree = (nodes) => {
    if (!searchFilter) return nodes;

    const filtered = [];
    for (const node of nodes) {
      const match = node.title.includes(searchFilter);
      const children = node.children ? filterTree(node.children) : [];
      if (match || children.length) {
        filtered.push({ ...node, children });
      }
    }
    return filtered;
  };

  // 预览搜索：跳转到下一处
  const handlePreviewSearchNext = () => {
    if (previewSearchMatches.length === 0) return;
    const nextIndex = (previewSearchIndex + 1) % previewSearchMatches.length;
    setPreviewSearchIndex(nextIndex);

    // 滚动到对应位置
    const previewElement = document.getElementById(`preview-match-${nextIndex}`);
    if (previewElement) {
      previewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 预览搜索：跳转到上一处
  const handlePreviewSearchPrev = () => {
    if (previewSearchMatches.length === 0) return;
    const prevIndex = (previewSearchIndex - 1 + previewSearchMatches.length) % previewSearchMatches.length;
    setPreviewSearchIndex(prevIndex);

    // 滚动到对应位置
    const previewElement = document.getElementById(`preview-match-${prevIndex}`);
    if (previewElement) {
      previewElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };


  // 统计预览搜索的匹配数 - 缓存正则表达式
  const previewSearchRegexRef = React.useRef(null);
  const previewSearchJsonStrRef = React.useRef(null);

  useEffect(() => {
    if (!previewSearch || !json) {
      setPreviewSearchMatches([]);
      previewSearchRegexRef.current = null;
      return;
    }

    // 只在搜索词改变时重新编译正则
    const jsonStr = JSON.stringify(json, null, 2);
    if (previewSearchJsonStrRef.current === jsonStr && previewSearchRegexRef.current) {
      return;
    }

    previewSearchJsonStrRef.current = jsonStr;
    try {
      const escapedSearch = previewSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      previewSearchRegexRef.current = new RegExp(escapedSearch, 'gi');

      // 限制匹配数量，避免处理过多的匹配项
      const matches = [];
      let match;
      const regex = new RegExp(escapedSearch, 'gi');
      const MAX_MATCHES = 1000;

      while ((match = regex.exec(jsonStr)) !== null && matches.length < MAX_MATCHES) {
        matches.push(match.index);
      }

      setPreviewSearchMatches(matches);
      setPreviewSearchIndex(0);
    } catch (e) {
      // 正则错误时清空匹配
      setPreviewSearchMatches([]);
    }
  }, [previewSearch, json]);

  // 检查路径或其子路径是否有变化
  const hasChangesInPath = (changedPaths, currentPath) => {
    const pathStr = currentPath.join('.');
    // 检查当前路径是否变化
    if (changedPaths.has(pathStr)) return true;
    // 检查是否有子路径变化
    for (const changedPath of changedPaths) {
      if (changedPath.startsWith(pathStr + '.')) return true;
    }
    return false;
  };

  // 创建搜索计数器的闭包
  const createRenderJsonWithHighlight = (searchMatchCounterRef) => {
    return function renderJsonWithHighlight(obj, changedPaths, path = [], indent = 0, maxLines = 10000) {
      if (maxLines <= 0) {
        return '...内容过多，已隐藏';
      }

      const indentStr = '  '.repeat(indent);
      const lines = [];
      let linesCount = 0;

      // 高亮搜索内容的辅助函数 - 优化版本
      const highlightSearchText = (text) => {
        if (!previewSearch || !previewSearchRegexRef.current) return text;

        const regex = previewSearchRegexRef.current;
        regex.lastIndex = 0;
        const parts = text.split(new RegExp(`(${previewSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));

        return parts.map((part, i) => {
          if (i % 2 === 1) { // 匹配的部分
            const currentMatchIndex = searchMatchCounterRef.current;
            searchMatchCounterRef.current++;
            const isActive = currentMatchIndex === previewSearchIndex;
            return `<span id="preview-match-${currentMatchIndex}" style="background-color: ${isActive ? '#ffa940' : '#ffe58f'}; padding: 2px 4px; border-radius: 2px; font-weight: 600;">${part}</span>`;
          }
          return part;
        }).join('');
      };


      if (Array.isArray(obj)) {
        const filteredItems = [];
        const displayLimit = Math.min(obj.length, 500); // 数组最多显示 500 项

        for (let idx = 0; idx < displayLimit; idx++) {
          const item = obj[idx];
          const currentPath = [...path, idx];
          const pathStr = currentPath.join('.');
          const isChanged = changedPaths.has(pathStr);
          const hasChildChanges = hasChangesInPath(changedPaths, currentPath);

          if (showOnlyChanges && !isChanged && !hasChildChanges) continue;

          if (typeof item === 'object' && item !== null) {
            const subLines = renderJsonWithHighlight(item, changedPaths, currentPath, indent + 1, maxLines - filteredItems.length);
            filteredItems.push(subLines);
          } else {
            const valueStr = JSON.stringify(item);
            const line = `${indentStr}  ${valueStr}`;
            const highlightedLine = highlightSearchText(line);

            filteredItems.push(
              isChanged
                ? `<span style="color: #cf1322; font-weight: 600;">${highlightedLine}</span>`
                : highlightedLine
            );
          }
          linesCount++;
          if (linesCount >= maxLines) break;
        }

        if (displayLimit < obj.length) {
          filteredItems.push(`<span style="color: #999;">... 还有 ${obj.length - displayLimit} 项</span>`);
        }

        if (filteredItems.length === 0 && showOnlyChanges) {
          return '[]';
        }

        lines.push('[');
        filteredItems.forEach((item, idx) => {
          const comma = idx < filteredItems.length - 1 ? ',' : '';
          lines.push(item + comma);
        });
        lines.push(`${indentStr}]`);
      } else if (typeof obj === 'object' && obj !== null) {
        const filteredEntries = [];
        const entries = Object.entries(obj);
        const displayLimit = Math.min(entries.length, 500); // 对象最多显示 500 个字段

        for (let i = 0; i < displayLimit; i++) {
          const [key, value] = entries[i];
          const currentPath = [...path, key];
          const pathStr = currentPath.join('.');
          const isChanged = changedPaths.has(pathStr);
          const hasChildChanges = hasChangesInPath(changedPaths, currentPath);

          if (showOnlyChanges && !isChanged && !hasChildChanges) continue;

          if (typeof value === 'object' && value !== null) {
            const keyLine = `${indentStr}  "${key}": `;
            const highlightedKey = highlightSearchText(keyLine);
            const subLines = renderJsonWithHighlight(value, changedPaths, currentPath, indent + 1, maxLines - filteredEntries.length);

            const keyPart = isChanged
              ? `<span style="color: #cf1322; font-weight: 600;">${highlightedKey}</span>`
              : highlightedKey;

            filteredEntries.push(keyPart + subLines);
          } else {
            const valueStr = JSON.stringify(value);
            const line = `${indentStr}  "${key}": ${valueStr}`;
            const highlightedLine = highlightSearchText(line);

            filteredEntries.push(
              isChanged
                ? `<span style="color: #cf1322; font-weight: 600;">${highlightedLine}</span>`
                : highlightedLine
            );
          }
          linesCount++;
          if (linesCount >= maxLines) break;
        }

        if (displayLimit < entries.length) {
          filteredEntries.push(`<span style="color: #999;">... 还有 ${entries.length - displayLimit} 个字段</span>`);
        }

        if (filteredEntries.length === 0 && showOnlyChanges) {
          return '{}';
        }

        lines.push('{');
        filteredEntries.forEach((entry, idx) => {
          const comma = idx < filteredEntries.length - 1 ? ',' : '';
          lines.push(entry + comma);
        });
        lines.push(`${indentStr}}`);
      }

      return lines.join('\n');
    };
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 左侧编辑器 */}
      <div style={{
        flex: 1,
        padding: 24,
        overflow: 'auto',
        borderRight: '1px solid #e8e8e8'
      }}>
        <Title level={3} style={{ marginBottom: 16 }}>JSON 编辑器</Title>

        <div style={{ marginBottom: 16 }}>
          <Upload beforeUpload={handleFileUpload} accept=".json" showUploadList={false} disabled={isLoading}>
            <Button icon={<UploadOutlined />} loading={isLoading}>
              {isLoading ? '加载中...' : '上传 JSON 文件'}
            </Button>
          </Upload>
        </div>

        {json ? (
          <>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Input
                placeholder="搜索 key 或 value"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1 }}
                onPressEnter={() => {
                  if (!search) {
                    message.warning("请输入搜索内容");
                    return;
                  }
                  setSearchFilter(search);
                }}
              />
              <Button onClick={() => {
                if (!search) {
                  message.warning("请输入搜索内容");
                  return;
                }
                setSearchFilter(search);
              }}>
                查找
              </Button>
              <Button onClick={handleBatchEdit} disabled={!search}>
                批量修改
              </Button>
            </div>
            <Tree
              treeData={filterTree(treeData)}
              onSelect={handleSelect}
              selectedKeys={selected}
              defaultExpandAll
              style={{ marginBottom: 16 }}
              titleRender={(node) => {
                if (node.disabled) return node.title;

                return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ flex: 1 }}>
                      {node.title}
                    </span>
                    {node.isLeaf && (
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          const value = getValueByPath(json, node.path);
                          setEditModal({
                            open: true,
                            path: node.path,
                            value: JSON.stringify(value)
                          });
                        }}
                        style={{ padding: '0 4px', height: '20px', lineHeight: '20px' }}
                      >
                        编辑
                      </Button>
                    )}
                    {(node.isArray || node.isObject) && (
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddModal({
                            open: true,
                            path: node.path,
                            key: "",
                            value: ""
                          });
                        }}
                        style={{ padding: '0 4px', height: '20px', lineHeight: '20px' }}
                      >
                        添加
                      </Button>
                    )}
                  </div>
                );
              }}
            />
            <Button onClick={handleEdit} disabled={!selected.length} style={{ marginRight: 8 }}>编辑</Button>
            <Button onClick={handleDelete} disabled={!selected.length} style={{ marginRight: 8 }}>删除</Button>
            <Button onClick={handleAdd} disabled={!selected.length} style={{ marginRight: 8 }}>新增</Button>
            <Button onClick={handleExport}>导出 JSON</Button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            请上传 JSON 文件以开始编辑
          </div>
        )}
      </div>

      {/* 右侧预览 */}
      <div style={{
        width: 600,
        padding: 24,
        backgroundColor: '#fafafa',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12
        }}>
          <Title level={3} style={{ margin: 0 }}>实时预览</Title>
          {json && (
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleCopyJson}
            >
              复制
            </Button>
          )}
        </div>

        {json && (
          <>
            <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input
                placeholder="搜索内容"
                value={previewSearch}
                onChange={e => {
                  setPreviewSearch(e.target.value);
                  setPreviewSearchIndex(0);
                }}
                style={{ flex: 1 }}
                allowClear
              />
              <Button
                onClick={handlePreviewSearchPrev}
                disabled={!previewSearch || previewSearchMatches.length === 0}
              >
                上一处
              </Button>
              <Button
                onClick={handlePreviewSearchNext}
                disabled={!previewSearch || previewSearchMatches.length === 0}
              >
                下一处
              </Button>
            </div>

            <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showOnlyChanges}
                  onChange={e => setShowOnlyChanges(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                <span style={{ fontSize: 14 }}>只显示修改</span>
              </label>
              {originalJson && (
                <span style={{ fontSize: 12, color: '#666' }}>
                  已修改 {findChangedPaths(originalJson, json).size} 处
                </span>
              )}
              {previewSearch && (
                <span style={{ fontSize: 12, color: '#666' }}>
                  找到 {previewSearchMatches.length} 处
                </span>
              )}
            </div>
          </>
        )}

        {json ? (
          <>
            <pre
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 16,
                backgroundColor: '#fff',
                borderRadius: 4,
                fontSize: 13,
                lineHeight: 1.5,
                border: '1px solid #e8e8e8',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
              dangerouslySetInnerHTML={{
                __html: originalJson
                  ? (() => {
                      const counterRef = { current: 0 };
                      const renderFn = createRenderJsonWithHighlight(counterRef);
                      return renderFn(json, findChangedPaths(originalJson, json));
                    })()
                  : JSON.stringify(json, null, 2)
              }}
            />
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999'
          }}>
            暂无内容
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        open={editModal.open}
        title="编辑字段"
        onOk={handleEditOk}
        onCancel={() => setEditModal({ open: false, path: [], value: "" })}
      >
        <Input.TextArea
          value={editModal.value}
          onChange={e => setEditModal({ ...editModal, value: e.target.value })}
          rows={4}
        />
      </Modal>

      {/* 新增弹窗 */}
      <Modal
        open={addModal.open}
        title="新增字段"
        onOk={handleAddOk}
        onCancel={() => setAddModal({ open: false, path: [], key: "", value: "" })}
      >
        <Input
          placeholder="key (数组可不填)"
          value={addModal.key}
          onChange={e => setAddModal({ ...addModal, key: e.target.value })}
          style={{ marginBottom: 8 }}
        />
        <Input.TextArea
          placeholder="value (JSON格式)"
          value={addModal.value}
          onChange={e => setAddModal({ ...addModal, value: e.target.value })}
          rows={4}
        />
      </Modal>

      {/* 批量修改弹窗 */}
      <Modal
        open={batchModal.open}
        title={`批量修改 (共 ${batchModal.matches.length} 个字段，已选 ${batchModal.selectedMatches.size} 个)`}
        onOk={handleBatchEditOk}
        onCancel={() => setBatchModal({ open: false, matches: [], value: "", selectedMatches: new Set() })}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>将要修改的字段：</span>
            <Button
              type="link"
              size="small"
              onClick={() => {
                const newSelected = new Set(batchModal.matches.map((_, idx) => idx));
                setBatchModal({ ...batchModal, selectedMatches: newSelected });
              }}
            >
              全选
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setBatchModal({ ...batchModal, selectedMatches: new Set() });
              }}
            >
              全不选
            </Button>
          </div>
          <div style={{
            maxHeight: 250,
            overflow: 'auto',
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            fontSize: 12
          }}>
            {batchModal.matches.map((match, idx) => (
              <div key={idx} style={{ padding: '6px 0', display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={batchModal.selectedMatches.has(idx)}
                  onChange={(e) => {
                    const newSelected = new Set(batchModal.selectedMatches);
                    if (e.target.checked) {
                      newSelected.add(idx);
                    } else {
                      newSelected.delete(idx);
                    }
                    setBatchModal({ ...batchModal, selectedMatches: newSelected });
                  }}
                  style={{ marginRight: 8, cursor: 'pointer' }}
                />
                <span style={{ cursor: 'pointer' }} onClick={() => {
                  const newSelected = new Set(batchModal.selectedMatches);
                  if (newSelected.has(idx)) {
                    newSelected.delete(idx);
                  } else {
                    newSelected.add(idx);
                  }
                  setBatchModal({ ...batchModal, selectedMatches: newSelected });
                }}>
                  {match.key} ({match.title})
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>新值 (JSON 格式)：</div>
          <Input.TextArea
            placeholder='例如: "新值" 或 123 或 true'
            value={batchModal.value}
            onChange={e => setBatchModal({ ...batchModal, value: e.target.value })}
            rows={4}
          />
        </div>
      </Modal>
    </div>
  );
}

