---
name: m4-app-lcl
description: 当想查询 调度场景信息，机器人状态，发送运单时，调用此 Skill。
---

# 调用接口

baseUrl 是 http://localhost:5800/api/

header 中要添加
xyy-app-id:m4
xyy-app-key:m4

请求示例：

```
GET http://localhost:5800/api/<url>
Content-Type: application/json
xyy-app-id: m4
xyy-app-key: m4
```

当需要查询调度场景信息时，参考 references/scene.md 中的文档。
