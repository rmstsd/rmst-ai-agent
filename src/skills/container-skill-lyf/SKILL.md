---
name: container-skill-lyf

description: 查询、创建、编辑和批量编辑 M4 容器搬运单。业务对象固定为 ContainerTransportOrder，支持按任务 ID 查看、按完整请求 JSON 新增或编辑，以及根据 m4-query 查询出的条件批量更新。
---

# 容器搬运单 Skill

## 适用范围

本 Skill 专门处理 M4 容器搬运单业务对象：

```text
ContainerTransportOrder
```

支持以下操作：

- 查看单条容器搬运单
- 新增容器搬运单
- 编辑单条容器搬运单
- 按查询条件批量编辑容器搬运单

查询容器搬运单列表或查找任务 ID 时，使用 `m4-query` Skill；本 Skill 的脚本只负责单条查看和写入操作。

## 工作流程

### 查看单条任务

1. 用户提供任务 ID 时，直接调用 `view`。
2. 用户未提供任务 ID 时，使用 `m4-query` 查询 `ContainerTransportOrder`，确认目标任务后再调用 `view`。
3. 不要根据任务编号猜测任务详情。

```bat
scripts\container-skill.bat view <任务ID>
```

### 新增任务

1. 确认至少有 `kind` 和 `status` ，`priority`,`remark`,`robotName`,`fromBin`,`toBin`,`sourceOrderId`,`falconTaskDefName`,`expectedRobot`,`postProcessMark` 这些字段为选填部分。
2. `id` 不需要填写，由系统自动生成。
3. 将完整请求保存为 JSON 文件。
4. 调用 `create`，接口返回 HTTP `200` 才表示成功。
5. 新增成功后，返回的 `id` 即为新任务 ID，用户可使用 `view` 查看新任务详情。

```bat
scripts\container-skill.bat create <请求JSON文件路径>
```

请求文件格式：

```json
{
  "entityName": "ContainerTransportOrder",
  "entityValue": {
    "kind": "搬运5",
    "status": "Building",
    "priority": 0,
    "atPort": false,
    "loaded": false,
    "unloaded": false
  }
}
```

### 编辑单条任务

1. 先使用 `view` 获取当前任务详情。
2. 只修改用户明确要求的字段。
3. 请求中保留任务 `id` 和需要修改的 `update` 字段。
4. 不要把未修改字段凭空写入 `update`。

```bat
scripts\container-skill.bat update <请求JSON文件路径>
```

请求文件格式：

```json
{
  "entityName": "ContainerTransportOrder",
  "id": "CTO20260825-0004",
  "update": {
    "priority": 1
  }
}
```

### 批量编辑任务

1. 先用 `m4-query` 查询目标任务，确认筛选条件或任务 ID。
2. 用户指定一组 ID 时，使用 `id In [...]` 作为 `query`。
3. 只把需要变更的字段放到 `update`。
4. 执行前明确告知用户将影响的筛选条件或任务数量。
5. 调用 `batch-update`，接口返回 HTTP `200` 才表示成功。

```bat
scripts\container-skill.bat batch-update <请求JSON文件路径>
```

请求文件格式：

```json
{
  "entityName": "ContainerTransportOrder",
  "query": {
    "type": "General",
    "field1": "id",
    "operator": "In",
    "value": ["CTO20260825-0005", "CTO20260825-0004"]
  },
  "update": {
    "priority": 1
  }
}
```

## 状态为失败时要给出失败原因

## 重要约束

- `entityName` 固定为 `ContainerTransportOrder`，不要替换成其他业务对象。
- 新增前必须确认 `kind` 和 `status`；`id` 由系统生成。
- 编辑前先查询详情，避免覆盖未知字段。
- 批量编辑前先确认查询条件；不能把分页结果总数当成实际任务数量。
- 只修改用户明确要求的字段，不删除或重置其他字段。
- 不要把中文显示名直接当作字段名；字段名参考 [references/base.md](references/base.md)。
- 查询条件结构遵循 `m4-query` Skill 的规则。
- 本 Skill 会执行写入操作，执行前需要得到用户明确授权。

## 认证与环境

脚本默认连接：

```text
http://127.0.0.1:5800
```

可通过环境变量覆盖：

```bat
set M4_BASE_URL=http://127.0.0.1:5800
set M4_APP_ID=test
set M4_APP_KEY=test
```

详细字段说明见 [references/base.md](references/base.md)，接口说明见 [references/api.md](references/api.md)。
