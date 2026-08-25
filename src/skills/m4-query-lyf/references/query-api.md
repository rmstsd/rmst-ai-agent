# M4 通用数据查询接口

## 接口

```text
POST /api/entity/find/page
```

完整地址：

```text
<M4_BASE_URL>/api/entity/find/page
```

请求头：

```text
xyy-app-id: test
xyy-app-key: test
Content-Type: application/json
Accept: application/json
```


## 请求体

```json
{
  "entityName": "HumanUser",
  "query": null,
  "pageNo": 1,
  "pageSize": 50,
  "projection": null,
  "sort": ["-id"]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `entityName` | string | 业务对象名称 |
| `query` | object/null | 查询条件，`null` 表示查询全部 |
| `pageNo` | number | 页码，从 `1` 开始 |
| `pageSize` | number | 每页数量 |
| `projection` | string[]/null | 要返回的字段，`null` 表示全部字段 |
| `sort` | string[] | 排序字段，字段名前的 `-` 表示倒序 |

## 查询条件

### 全部

```json
{
  "type": "All"
}
```

分页查询中也可以直接将 `query` 设置为 `null`。

### 通用条件

```json
{
  "type": "General",
  "field1": "vendor",
  "operator": "Eq",
  "value": "QA0001"
}
```

### 复合条件

`or` 为 `false` 表示 AND，`true` 表示 OR：

```json
{
  "type": "Compound",
  "or": false,
  "items": [
    {
      "type": "General",
      "field1": "vendor",
      "operator": "Eq",
      "value": "QA0001"
    },
    {
      "type": "General",
      "field1": "status",
      "operator": "In",
      "value": ["Created", "Pending"]
    }
  ]
}
```

## 操作符

| 操作符 | `value` | 说明 |
| --- | --- | --- |
| `Eq` | 单值 | 等于 |
| `Ne` | 单值 | 不等于 |
| `Gt` / `Gte` | 单值 | 大于 / 大于等于 |
| `Lt` / `Lte` | 单值 | 小于 / 小于等于 |
| `In` | 数组 | 匹配数组中的任意值 |
| `Between` | 两元素数组 | 闭区间，适用于数字和日期 |
| `Contain` | 文本 | 包含文本 |
| `ContainIgnoreCase` | 文本 | 忽略大小写包含 |
| `Start` | 文本 | 以文本开头 |
| `End` | 文本 | 以文本结尾 |
| `Null` | 不需要 | 字段值为 null |
| `NotNull` | 不需要 | 字段值不为 null |
| `Empty` | 不需要 | 文本为 null 或空字符串 |
| `NotEmpty` | 不需要 | 文本不为空 |
| `CurrentUser` | 不需要 | 当前用户 ID |
| `CurrentUsername` | 不需要 | 当前用户名 |
| `ThisWeek` | 不需要 | 当前周日期范围 |

## 响应

成功时返回 HTTP `200`：

```json
{
  "pageNo": 1,
  "pageSize": 50,
  "total": 1,
  "page": [
    {
      "id": "example"
    }
  ]
}
```

- `total`：符合条件的总数据量。
- `page`：当前页数据。
- `pageNo`、`pageSize`：实际分页信息。

## 查询前确认字段

通用查询接口不会自动把中文显示名转换成字段名。查询 `FbMaterial`、`FbBin` 或其他业务对象时，如果用户没有提供准确字段名，应先按照此文档查询：[entity-api.md](entity-api.md)

然后从返回配置的 `fields` 中确认字段名。
