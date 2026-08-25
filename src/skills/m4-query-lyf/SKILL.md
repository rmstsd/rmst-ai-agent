---
name: m4-query-lyf

description: 查询 M4 任意业务对象的数据。根据用户提供的业务对象名称、字段条件、分页、排序和返回字段，构造查询条件并调用 M4 通用分页查询接口。仅负责查询，不负责创建、修改或删除数据。
---

# M4 通用数据查询 Skill

## 适用范围

当用户要求查询 M4 业务对象数据时使用本 Skill，例如查询：

- `FbMaterial` 物料
- `FbBin` 库位
- 机器人、订单、任务等其他业务对象

业务对象元数据配置的查询参考 [entity-api.md](entity-api.md) 中的接口。

## 查询流程

1. 确认业务对象名称，作为请求中的 `entityName`。
2. 如果用户提供的字段名不明确，先通过以下脚本查询业务对象元数据，不要猜测字段：

   ```bat
   scripts\m4-entity.bat get <业务对象名>
   ```

3. 将用户的自然语言条件转换为 `query` 查询对象。
4. 根据用户要求设置 `pageNo`、`pageSize`、`projection` 和 `sort`。
5. 将完整请求保存为临时 JSON 文件。
6. 使用查询脚本调用：

   ```bat
   scripts\m4-query.bat query <请求JSON文件路径>
   ```

7. 根据响应中的 `total` 和 `page` 返回查询结果，并说明实际使用的业务对象和查询条件。

## 请求格式

请求 JSON 必须包含 `entityName`。其他字段可以省略，脚本会使用默认值：

```json
{
  "entityName": "FbMaterial",
  "query": null,
  "pageNo": 1,
  "pageSize": 50,
  "projection": null,
  "sort": []
}
```

默认值：

- `query`: `null`，查询全部数据
- `pageNo`: `1`
- `pageSize`: `50`
- `projection`: `null`，返回全部字段
- `sort`: `[]`，不指定排序

## 查询条件规则

查询条件支持三类节点：

- `All`：全部数据
- `General`：单字段条件
- `Compound`：多个条件的 AND/OR 组合

单字段条件示例：

```json
{
  "type": "General",
  "field1": "字段名",
  "operator": "Eq",
  "value": "字段值"
}
```

多条件默认使用 AND：

```json
{
  "type": "Compound",
  "or": false,
  "items": [
    {
      "type": "General",
      "field1": "字段一",
      "operator": "Eq",
      "value": "值一"
    },
    {
      "type": "General",
      "field1": "字段二",
      "operator": "Contain",
      "value": "关键字"
    }
  ]
}
```

只有用户明确表达“或者”时才使用 `"or": true`。

支持的操作符及值类型：

| 操作符               | 用法                       |
| -------------------- | -------------------------- |
| `Eq` / `Ne`          | 等于 / 不等于              |
| `Gt` / `Gte`         | 大于 / 大于等于            |
| `Lt` / `Lte`         | 小于 / 小于等于            |
| `In`                 | `value` 使用数组           |
| `Between`            | `value` 使用两个元素的数组 |
| `Contain`            | 文本包含                   |
| `ContainIgnoreCase`  | 忽略大小写的文本包含       |
| `Start` / `End`      | 文本开头 / 结尾匹配        |
| `Null` / `NotNull`   | 等于 null / 不等于 null    |
| `Empty` / `NotEmpty` | 文本为空 / 不为空          |
| `CurrentUser`        | 当前用户，不需要 `value`   |
| `CurrentUsername`    | 当前用户名，不需要 `value` |
| `ThisWeek`           | 本周日期，不需要 `value`   |

不要为 `CurrentUser`、`CurrentUsername` 和 `ThisWeek` 人工补充 `value`。

## 分页、字段和排序

只返回指定字段时使用 `projection`：

```json
"projection": ["id", "name", "status"]
```

排序字段前加 `-` 表示倒序，使用 `+` 或不加前缀表示正序：

```json
"sort": ["-createdOn", "+id"]
```

如果用户没有明确要求返回字段，不要凭空生成 `projection`。

## 重要约束

- 不确定业务对象名称时，先查询元数据或让用户确认。
- 不确定字段名称时，先查询对应业务对象的元数据。
- 不要根据业务对象的中文显示名猜测字段名。
- 不要根据分页总数伪造数据行，只展示接口实际返回的 `page`。
- 查询结果过大时，优先缩小 `pageSize` 或使用 `projection`。
- 本 Skill 只调用 `POST /api/entity/find/page`，不调用创建、更新、删除接口。

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

服务要求浏览器会话认证时，可以额外设置：

详细接口和查询条件说明见 [references/query-api.md](references/query-api.md)。
