import React, { useState } from "react";
import { Tree, Input, Button, Modal, message, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";

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

export default function JsonEditor() {
  const [json, setJson] = useState(null);
  const [treeData, setTreeData] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, path: [], value: "" });
  const [addModal, setAddModal] = useState({ open: false, path: [], key: "", value: "" });
  const [previewModal, setPreviewModal] = useState(false);
  const [batchModal, setBatchModal] = useState({ open: false, matches: [], value: "" });

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setJson(data);
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

  return (
    <div style={{ padding: 24 }}>
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
          <Button onClick={handleExport} style={{ marginRight: 8 }}>导出 JSON</Button>
          <Button onClick={() => setPreviewModal(true)}>预览 JSON</Button>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          请上传 JSON 文件以开始编辑
        </div>
      )}

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
      <Modal
        open={previewModal}
        title="预览 JSON"
        onCancel={() => setPreviewModal(false)}
        footer={[
          <Button key="copy" type="primary" onClick={handleCopyJson}>
            一键复制
          </Button>,
          <Button key="close" onClick={() => setPreviewModal(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <pre style={{
          maxHeight: 600,
          overflow: 'auto',
          padding: 16,
          backgroundColor: '#f5f5f5',
          borderRadius: 4,
          fontSize: 13,
          lineHeight: 1.5
        }}>
          {JSON.stringify(json, null, 2)}
        </pre>
      </Modal>
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

