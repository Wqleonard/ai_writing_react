# MainAgent 中断恢复接口对接指南（前端）

本文档用于前端对接 `streamFromLangGraph`（`/api/works/chat`）在中断场景下的恢复协议，重点说明：

- 继续保留的旧字段：`command`
- 新增兼容字段：`commandPayload`
- 四种中断恢复类型：`approve`、`reject`、`edit`、`form`

---

## 1. 接口说明

- **Method**: `POST`
- **Path**: `/api/works/chat`
- **Content-Type**: `application/json`
- **Accept**: `text/event-stream`

该接口既用于普通对话，也用于中断后 `resume` 恢复。

---

## 2. 兼容策略

后端当前采用「`command` 主导，`commandPayload` 增强」模式：

- 只传 `command`：兼容旧逻辑
- 传 `command + commandPayload`：用于 `edit/form` 等需要额外参数的场景

### 2.1 字段定义（新增部分）

```json
{
  "command": "approve | reject | edit | form",
  "commandPayload": {
    "type": "todo | form",
    "message": "仅 reject 可选",
    "edited_action": {},
    "decisions": []
  }
}
```

`commandPayload` 字段说明：

- `type`：可选，主要给 `form` 场景显式指定；不传时后端按 `command` 推断。
- `message`：可选，`reject` 的附加原因。
- `edited_action`：可选，`edit` 场景传编辑后的 action。
- `decisions`：可选，`form` 场景的答案数组（与算法侧协议一致）。

---

## 3. 四种恢复请求示例

下面示例仅展示中断恢复相关字段。实际请求仍需保留业务必填字段（如 `query`、`sessionId`、`workId`、`tools`、`notes` 等）。

### 3.1 approve（兼容旧方式）

```json
{
  "command": "approve"
}
```

### 3.2 reject（可带原因）

```json
{
  "command": "reject",
  "commandPayload": {
    "message": "参数不符合预期，请重新生成"
  }
}
```

### 3.3 edit（带 edited_action）

```json
{
  "command": "edit",
  "commandPayload": {
    "edited_action": {
      "name": "tool_name",
      "args": {
        "key": "new-value"
      }
    }
  }
}
```

### 3.4 form（带 decisions）

```json
{
  "command": "form",
  "commandPayload": {
    "type": "form",
    "decisions": [
      { "id": 1, "question": "请选择风格", "answer": ["轻松"] },
      { "id": 2, "question": "请选择元素", "answer": ["海边", "落日"] }
    ]
  }
}
```

---

## 4. 后端映射行为

后端根据 `command` 做分发：

- `approve` -> `resume.type=todo` + `decisions=[{type: approve}]`
- `reject` -> `resume.type=todo` + `decisions=[{type: reject, message?}]`
- `edit` -> `resume.type=todo` + `decisions=[{type: edit, edited_action?}]`
- `form` -> `resume.type=form` + `decisions=commandPayload.decisions`

说明：

- `form` 场景若 `decisions` 为空，后端仍可透传空数组，但前端应避免空提交。
- 建议在前端基于中断类型做参数校验，再发起恢复请求。

---

## 5. 前端对接建议

- 旧代码可先只传 `command`，保证兼容。
- 新版建议统一传 `commandPayload`，便于后续扩展更多中断类型。
- `edit`、`form` 场景在提交前做本地校验：
  - `edit` 必须有 `edited_action`
  - `form` 必须有有效 `decisions`

