# 容器搬运单 API

## 查看单条详细信息

```text
POST /api/entity/find/one
```

请求体：

```json
{
  "entityName": "ContainerTransportOrder",
  "id": "CTO20260825-0001"
}
```

## 新增

```text
POST /api/entity/create/one
```

请求体：

```json
{
  "entityName": "ContainerTransportOrder",
  "entityValue": {
    "kind": "搬运5",
    "status": "Building"
  }
}
```

返回响应:创建的容器搬运单 id
```json
{
    "id": "CTO20260825-0006"
}
```

## 编辑单条

```text
POST /api/entity/update/one
```

请求体：

```json
{
  "entityName": "ContainerTransportOrder",
  "id": "CTO20260825-0004",
  "update": {
    "priority": 1
  }
}
```

## 批量编辑

```text
POST /api/entity/update/many
```

请求体：

```json
{
  "entityName": "ContainerTransportOrder",
  "query": {
    "type": "General",
    "field1": "id",
    "operator": "In",
    "value": [
      "CTO20260825-0005",
      "CTO20260825-0004"
    ]
  },
  "update": {
    "remark": "123"
  }
}
```

## 请求头

```text
xyy-app-id: test
xyy-app-key: test
Content-Type: application/json
Accept: application/json
```


HTTP `200` 表示对应操作成功；其他状态码应保留接口返回的错误内容。
