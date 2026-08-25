# ContainerTransportOrder 字段说明

业务对象名称：

```text
ContainerTransportOrder
```

## 基础字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 容器搬运单编号，系统生成 |
| `kind` | string | 搬运任务类型，新增必填 |
| `status` | string | 任务状态，新增必填 |
| `priority` | integer | 优先级 |
| `remark` | string | 备注 |

## 搬运对象和位置

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `container` | reference | 搬运容器 |
| `fromBin` | string | 起点库位 |
| `fromChannel` | string | 起点巷道 |
| `toBin` | string | 终点库位 |
| `toChannel` | string | 终点巷道 |
| `robotName` | string | 执行机器人 |
| `expectedRobot` | string | 指定机器人 |

## 执行状态

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `loaded` | boolean | 是否已取货 |
| `unloaded` | boolean | 是否已放货 |
| `atPort` | boolean | 是否在库口 |
| `errMsg` | string | 错误原因 |
| `doneOn` | datetime | 完成时间 |

## 关联信息

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sourceOrderId` | string | 关联单据编号 |
| `falconTaskId` | reference | 猎鹰任务编号 |
| `falconTaskDefId` | string | 猎鹰任务模板 ID |
| `falconTaskDefName` | string | 猎鹰任务模板名 |
| `postProcessMark` | string | 处理标记 |

## 状态值

文档中记录的常见业务状态：

| 状态 | 含义 |
| --- | --- |
| `Building` | 未提交/构建中 |
| `Created` | 已提交/已创建 |
| `Dispatched` | 已派车 |
| `Failed` | 失败 |
| `Finished` | 完成 |
| `Canceled` | 取消 |

实际系统可能存在项目扩展状态。创建或修改前，如果状态值不确定，应先查询现有数据或业务对象元数据，不要凭空新增状态值。
