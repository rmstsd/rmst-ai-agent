# 普通运输订单架构

此架构适用于通过 `POST /api/fleet/orders/create` 创建从一个位置到另一个位置的普通搬运。

## Skill 生成的订单字段

| 字段 | 类型 | 规则 |
|---|---|---|
| `sceneId` | string | 必填；从场景列表中解析。 |
| `priority` | number | 可选；默认为 `0`。 |
| `expectedRobotNames` | string[] 或 null | 可选；由后端分配机器人时留空。 |
| `expectedRobotGroups` | string[] | 可选；仅在明确要求时设置。 |
| `containerId` | string | 可选；仅在操作员提供时设置。 |
| `containerTypeName` | string | 可选；仅在操作员提供时设置。 |
| `keyLocations` | string[] | 此流程必填；默认为第一个步骤的位置。 |
| `stepFixed` | boolean | 必填；完整的两步搬运使用 `true`。 |
| `steps` | object[] | 必填；按顺序排列的装载和卸载步骤。 |
| `firstKeyStep` | `Load` 或 `Unload` | 可选；仅在明确要求时设置。 |
| `tags` | string | 可选；仅在操作员提供时设置。 |

## Skill 生成的步骤字段

| 字段 | 类型 | 规则 |
|---|---|---|
| `status` | `"Executable"` | 新步骤必填。 |
| `location` | string | 必填；必须存在于场景架构中。 |
| `rbkArgs` | object | 使用 `{ "operation": "Load" }` 或 `{ "operation": "Unload" }`。 |
| `forLoad` | boolean | 仅装载步骤为 `true`。 |
| `forUnload` | boolean | 仅卸载步骤为 `true`。 |

对于“从 A 搬运到 B”的请求，先在 A 创建装载步骤，再在 B 创建卸载步骤。除非操作员提供了其他关键位置，否则将 `keyLocations` 设为 `[A]`。

## 不要臆造或默认设置

不要设置订单级别的 `id` 或 `status`；后端会生成 ID，并将状态默认为 `ToBeAllocated`。解析出 `sceneId` 后不要再生成 `sceneName`。除非操作员明确要求受支持的流程，否则不要添加方向、机器人标签、任务批次、脚本或高级步骤字段。

## 校验

- 场景必须已解析且处于启用状态。
- 每个步骤位置都必须是场景中的真实点位或货位。
- 当 `stepFixed` 为 `true` 时，`steps` 不能为空。
- 请求必须至少包含一个装载步骤和一个卸载步骤。
- 对于普通搬运，装载必须先于卸载。
