---
name: m4-app
description: 当想查询 调度场景信息，机器人状态，发送运单时，调用此 Skill。
---

# 调用接口

baseUrl 是 http://localhost:5800/api/

header 中要添加
xyy-app-id:m4
xyy-app-key:m4

请求示例：

```
GET http://localhost:5800/api/fleet/scenes/list
Content-Type: application/json
xyy-app-id: m4
xyy-app-key: m4
```

## 查询调度场景列表

GET `fleet/scenes/list`
