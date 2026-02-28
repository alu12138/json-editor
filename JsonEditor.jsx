import React, { useState, useEffect } from "react";
import { Tree, Input, Button, Modal, message, Upload, Typography } from "antd";
import { UploadOutlined, CopyOutlined } from "@ant-design/icons";

const { Title } = Typography;

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function buildTreeData(obj, path = []) {
  if (Array.isArray(obj)) {
    return obj.map((item, idx) => ({
      title: `[${idx}]`,
      key: [...path, idx].join("."),
      children: buildTreeData(item, [...path, idx]),
      isLeaf: typeof item !== "object" || item === null
    }));
  } else if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).map(([k, v]) => ({
      title: k,
      key: [...path, k].join("."),
      children: buildTreeData(v, [...path, k]),
      isLeaf: typeof v !== "object" || v === null
    }));
  } else {
    return [];
  }
}

function getValueByPath(obj, pathArr) {
  return pathArr.reduce((acc, cur) => acc?.[cur], obj);
}

function setValueByPath(obj, pathArr, value) {
  let last = pathArr.pop();
  let parent = pathArr.reduce((acc, cur) => acc[cur], obj);
  parent[last] = value;
}

function deleteByPath(obj, pathArr) {
  let last = pathArr.pop();
  let parent = pathArr.reduce((acc, cur) => acc[cur], obj);
  if (Array.isArray(parent)) parent.splice(last, 1);
  else delete parent[last];
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
  const [selected, setSelected] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, path: [], value: "" });
  const [addModal, setAddModal] = useState({ open: false, path: [], key: "", value: "" });
  const [batchModal, setBatchModal] = useState({ open: false, matches: [], value: "" });

  // 预览区搜索
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewSearchIndex, setPreviewSearchIndex] = useState(0);
  const [previewSearchMatches, setPreviewSearchMatches] = useState([]);

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setJson(data);
        setOriginalJson(deepClone(data)); // 保存原始数据
        setTreeData(buildTreeData(data));
        message.success("文件加载成功");
      } catch (error) {
        message.error("JSON 格式错误");
      }
    };
    reader.readAsText(file);
    return false; // 阻止自动上传
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
      setValueByPath(newJson, [...editModal.path], JSON.parse(editModal.value));
      setJson(newJson);
      setTreeData(buildTreeData(newJson));
      setEditModal({ open: false, path: [], value: "" });
      message.success("修改成功");
    } catch {
      message.error("值格式错误");
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
      const parent = getValueByPath(newJson, addModal.path);
      let val = JSON.parse(addModal.value);
      if (Array.isArray(parent)) parent.push(val);
      else parent[addModal.key] = val;
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
  const collectMatchedLeaves = (nodes, matches = []) => {
    nodes.forEach(node => {
      const isMatch = node.title.includes(search);
      if (isMatch && node.isLeaf) {
        matches.push({ key: node.key, title: node.title });
      }
      if (node.children && node.children.length > 0) {
        collectMatchedLeaves(node.children, matches);
      }
    });
    return matches;
  };

  const handleBatchEdit = () => {
    if (!search) {
      message.warning("请先输入搜索内容");
      return;
    }
    const matches = collectMatchedLeaves(treeData);
    if (matches.length === 0) {
      message.warning("没有找到匹配的叶子节点");
      return;
    }
    setBatchModal({ open: true, matches, value: "" });
  };

  const handleBatchEditOk = () => {
    try {
      const newJson = deepClone(json);
      let newValue = JSON.parse(batchModal.value);

      batchModal.matches.forEach(match => {
        const pathArr = match.key.split(".");
        setValueByPath(newJson, [...pathArr], newValue);
      });

      setJson(newJson);
      setTreeData(buildTreeData(newJson));
      setBatchModal({ open: false, matches: [], value: "" });
      message.success(`批量修改成功，共 ${batchModal.matches.length} 个字段`);
    } catch {
      message.error("值格式错误");
    }
  };

  const filterTree = (nodes) => {
    if (!search) return nodes;
    return nodes
      .map(node => {
        const match = node.title.includes(search);
        const children = node.children ? filterTree(node.children) : [];
        if (match || children.length) return { ...node, children };
        return null;
      })
      .filter(Boolean);
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

  // 只显示修改的内容
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  // 统计预览搜索的匹配数
  useEffect(() => {
    if (!previewSearch || !json) {
      setPreviewSearchMatches([]);
      return;
    }

    const jsonStr = JSON.stringify(json, null, 2);
    const regex = new RegExp(previewSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [];
    let match;

    while ((match = regex.exec(jsonStr)) !== null) {
      matches.push(match.index);
    }

    setPreviewSearchMatches(matches);
    setPreviewSearchIndex(0);
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
    return function renderJsonWithHighlight(obj, changedPaths, path = [], indent = 0) {
      const indentStr = '  '.repeat(indent);
      const lines = [];

      // 高亮搜索内容的辅助函数
      const highlightSearchText = (text) => {
        if (!previewSearch) return text;

        const regex = new RegExp(`(${previewSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, i) => {
          if (i % 2 === 1) { // 匹配的部分
            const currentMatchIndex = searchMatchCounterRef.current;
            searchMatchCounterRef.current++;
            const isActive = currentMatchIndex === previewSearchIndex;
            const id = `preview-match-${currentMatchIndex}`;
            return `<span id="${id}" style="background-color: ${isActive ? '#ffa940' : '#ffe58f'}; padding: 2px 4px; border-radius: 2px; font-weight: 600;">${part}</span>`;
          }
          return part;
        }).join('');
      };

      if (Array.isArray(obj)) {
        const filteredItems = [];
        obj.forEach((item, idx) => {
          const currentPath = [...path, idx];
          const pathStr = currentPath.join('.');
          const isChanged = changedPaths.has(pathStr);
          const hasChildChanges = hasChangesInPath(changedPaths, currentPath);

          if (showOnlyChanges && !isChanged && !hasChildChanges) return;

          if (typeof item === 'object' && item !== null) {
            const subLines = renderJsonWithHighlight(item, changedPaths, currentPath, indent + 1);
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
        });

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

        entries.forEach(([key, value]) => {
          const currentPath = [...path, key];
          const pathStr = currentPath.join('.');
          const isChanged = changedPaths.has(pathStr);
          const hasChildChanges = hasChangesInPath(changedPaths, currentPath);

          if (showOnlyChanges && !isChanged && !hasChildChanges) return;

          if (typeof value === 'object' && value !== null) {
            const keyLine = `${indentStr}  "${key}": `;
            const highlightedKey = highlightSearchText(keyLine);
            const subLines = renderJsonWithHighlight(value, changedPaths, currentPath, indent + 1);

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
        });

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
          <Upload beforeUpload={handleFileUpload} accept=".json" showUploadList={false}>
            <Button icon={<UploadOutlined />}>上传 JSON 文件</Button>
          </Upload>
        </div>

        {json ? (
          <>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <Input.Search
                placeholder="搜索 key 或 value"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 300 }}
              />
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
        title={`批量修改 (共 ${batchModal.matches.length} 个字段)`}
        onOk={handleBatchEditOk}
        onCancel={() => setBatchModal({ open: false, matches: [], value: "" })}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>将要修改的字段：</div>
          <div style={{
            maxHeight: 200,
            overflow: 'auto',
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            fontSize: 12
          }}>
            {batchModal.matches.map((match, idx) => (
              <div key={idx} style={{ padding: '2px 0' }}>
                {match.key} ({match.title})
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

