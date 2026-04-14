# 小说转短句接口调用指南（前端）

本文档基于当前后端实现整理，面向前端联调使用，覆盖：

- 小说转短句流式生成（SSE）
- 小说转短句历史：创建、更新、列表、详情

## 1. 鉴权与通用说明

- 接口前缀：`/api/works`
- 鉴权：需要登录态（如 Bearer Token）
- 用户隔离：历史记录按当前登录用户隔离，不能访问他人数据

### 1.1 非流式接口统一返回结构

历史相关接口返回统一结构：

```json
{
  "code": 200,
  "message": "Success",
  "data": {}
}
```

### 1.2 流式接口返回说明

`/novel-to-script` 是 `text/event-stream`，返回 `ServerSentEvent<String>` 流，不走统一 `code/message/data` 包装。

---

## 2. 接口总览

1) `POST /api/works/novel-to-script`：发起小说转短句（SSE）  
2) `POST /api/works/novel-to-script/history`：创建历史记录  
3) `PUT /api/works/novel-to-script/history/{historyId}`：更新历史结果  
4) `GET /api/works/novel-to-script/history`：查询历史列表  
5) `GET /api/works/novel-to-script/history/{historyId}`：查询历史详情

---

## 3. 小说转短句（SSE）

### 3.1 发起生成

- **Method**: `POST`
- **Path**: `/api/works/novel-to-script`
- **Content-Type**: `application/json`
- **Accept**: `text/event-stream`
- **余额要求**: `@RequireBalance(minBalance = 10000)`

#### 请求体

```json
{
  "attachmentName": "我的小说.pdf"
   "url":"https://example.com/novel/chapter-all",
}
```

字段说明：

- `url`：必填；小说来源地址

#### 前端接入要点

- 使用 `EventSource` 或 `fetch + readable stream` 处理 SSE。
- 建议先创建历史记录（第 4 章接口），拿到 `historyId` 后再发起生成，流结束后回写 `scriptResult`。

---

## 4. 小说转短句历史接口

### 4.1 创建历史记录

- **Method**: `POST`
- **Path**: `/api/works/novel-to-script/history`

#### 请求体

```json
{
  "attachmentName": "我的小说.pdf",
  "url": "https://example.com/novel/chapter-all"
}
```

#### 响应示例

```json
{
  "code": 200,
  "message": "Success",
  "data": 1024
}
```

说明：`data` 为 `historyId`。

### 4.2 更新历史结果

- **Method**: `PUT`
- **Path**: `/api/works/novel-to-script/history/{historyId}`

#### 请求体

```json
{
  "scriptResult": "第1集\n场景1：...\n（短剧正文）",
  "url": "https://example.com/novel/chapter-all"
}
```

说明：

- `scriptResult` 必填
- `url` 可选；传了会同步更新历史记录里的 `url`

#### 响应示例

```json
{
  "code": 200,
  "message": "Success",
  "data": null
}
```

### 4.3 查询历史列表

- **Method**: `GET`
- **Path**: `/api/works/novel-to-script/history`

#### 响应示例

```json
{
  "code": 200,
  "message": "Success",
  "data": [
    {
      "id": 1024,
      "attachmentName": "我的小说.pdf",
      "url": "https://example.com/novel/chapter-all",
      "scriptResult": "第1集\n场景1：...",
      "createdTime": "2026-04-14T15:30:00",
      "updatedTime": "2026-04-14T15:35:12"
    }
  ]
}
```

### 4.4 查询历史详情

- **Method**: `GET`
- **Path**: `/api/works/novel-to-script/history/{historyId}`

#### 响应示例

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "id": 1024,
    "attachmentName": "我的小说.pdf",
    "url": "https://example.com/novel/chapter-all",
    "scriptResult": "第1集\n场景1：...",
    "createdTime": "2026-04-14T15:30:00",
    "updatedTime": "2026-04-14T15:35:12"
  }
}
```

---

## 5. 常见错误与提示

常见入参校验：

- `attachmentName` 为空：`work.novel_to_script.attachment_name.required`
- `url` 为空：`work.novel_to_script.url_can_not_be_empty`
- `scriptResult` 为空：`work.novel_to_script.script_result.required`

常见业务错误：

- 历史记录不存在：`work.novel_to_script_history.not_found`
- 无权限访问他人历史：`work.permission_denied`（具体文案以后端 i18n 为准）

---

## 6. 推荐联调流程

1. 调用 `POST /novel-to-script/history` 创建记录，保存 `historyId`。  
2. 调用 `POST /novel-to-script` 发起 SSE 生成。  
3. 前端拼接完整文本后，调用 `PUT /novel-to-script/history/{historyId}` 回写 `scriptResult`。  
4. 页面刷新时调用列表/详情接口恢复历史结果。

