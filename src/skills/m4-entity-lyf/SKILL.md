---
name: m4-entity-lyf

description: M4 业务对象的配置查询修改，问题排查。根据用户提供的业务对象名称，查询或修改业务对象的配置，比如用户可能会查询库位配置，此时要根据库位业务对象的配置进行查询，一些常见配置问题可根据 [references/base.md](references/base.md) 中配置的描述来进行排查。
---

# M4 业务对象 Skill

## 概述

M4 业务对象是 M4 的低代码数据引擎和界面引擎。系统内的用户、库位、物料、运单、入库单等核心概念都是业务对象。当前内容针对业务对象的修改、配置和常见问题排查。

业务对象配置由元数据驱动，通常包含：

- 顶层业务对象信息：`name`、`label`、`group`、`scale`、禁用状态等。
- `fields`：字段定义集合，键为字段名。
- 字段显示配置：`fields.<fieldName>.view` 控制查看、新建、编辑、列表中的显示行为。
- `idGen`：编号生成配置，包括固定编号前缀和流水号宽度。
- `actions`：创建、修改、删除、导入、导出等操作开关。
- `pagesButtons`：列表、查看、新建、编辑页面的扩展按钮。
- `states`、`kinds`：状态和类型配置。

详细接口、请求头、完整请求报文和响应结构见 [references/api.md](references/api.md)。

# 注意 目前仅包含业务对象基础标签页的配置项 如果提问其他配置项告知用户暂不支持

## 工作流程

当用户要求查询、创建或修改业务对象时，必须使用终端脚本获取真实配置，不能根据业务对象名称猜测配置。

## 认证说明

脚本默认使用 `xyy-app-id` 和 `xyy-app-key` 请求头。只有服务端要求浏览器会话认证时，才需要在当前终端额外设置 `M4_COOKIE`。不要把真实 Cookie 写入技能文档或提交到代码库。

### 查询指定业务对象

```bat
set "M4_COOKIE=rl_page_init_referrer=RudderEncrypt%3AU2FsdGVkX19ZtD13qPkI6l12ihnImNk%2Fc%2Fkt%2F8SVy5s%3D; rl_page_init_referring_domain=RudderEncrypt%3AU2FsdGVkX19Cjd7llnw6AtvNscq2sb5%2Bj5oF1E8g8d4%3D; rl_anonymous_id=RudderEncrypt%3AU2FsdGVkX19HM1mLMzMasUDLNrvrScfbE9Jow7gdSV3xKt4JMkgdIzSqHsJMAYQJSC3b%2FuCdnUcwTLjNyQjrxQ%3D%3D; rl_user_id=RudderEncrypt%3AU2FsdGVkX18rZkRLX75lB%2BLvRTIj4dKWcIjexGn%2BsZaHh2zqAdKT8mk7sxLBwImYlEF48FYThci3LICxbsxGkKSfMxhgZEpX7jnBiTX1Tc5T27%2Fqufp726WWSlW9V%2BrtnnLed1dn0%2BKLHfA9dffqVm6pvgqrEpjfRpT2xU%2FlShw%3D; rl_trait=RudderEncrypt%3AU2FsdGVkX1%2BrNAhOj2IB7dSehOsuluh8S4DfpHSBfKYmUmO3%2Bv6GXrYZE2zc3aRcEXgIPBe5cevghGnwRYXwIcNJ255QJIGfmlhCZAm1sDYb7AYVhIaQBuj8ophuAnf92fQAqRDYEB2d1Q2r17iqy10Lf0lBW%2BZmhDuFZwWt1JE%3D; rl_session=RudderEncrypt%3AU2FsdGVkX19Sis6%2Bvr%2BBvxWkfO43tG%2BgU2o5N86hI6wND3YqydiHD1GEI5Tce5duUkAqVGdg6p5UqymTShG%2F2mb1K3%2BUNM6qXHObJorFzhrHr3PjAR7us30QUw4%2FEA3kqBjjMSfoK9Mx3C%2FpdL%2BIJw%3D%3D; ph_phc_4URIAm1uYfJO7j8kWSe0J8lc8IqnstRLS7Jx8NcakHo_posthog=%7B%22%24device_id%22%3A%22019bb1a6-ec7d-74f8-a1fe-299ef65a67cc%22%2C%22distinct_id%22%3A%22687eb39bdf55f37e42de547a70a27331f2cad1e6d737424ed3c1aa1a5c56aadd%23dac9813b-4c41-401e-9fbe-6f48f435447c%22%2C%22%24sesid%22%3A%5B1768214634976%2C%22019bb1a6-ec96-7754-ae2b-0a90d9079ff1%22%2C1768212065422%5D%2C%22%24epp%22%3Atrue%2C%22%24initial_person_info%22%3A%7B%22r%22%3A%22%24direct%22%2C%22u%22%3A%22http%3A%2F%2Flocalhost%3A5678%2Fhome%2Fworkflows%22%7D%7D; authjs.session-token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiSnItaUVNT2ZuWk05eE1nc21fM2xkZV9DYnk2MC0tRy1ZSTBQVk4wLURYQm5ZUlk5Tll1REsxLUV4UnUwbEpPLUpxbXRNV0FsVU5WTUpUYXNkaGFKeEEifQ..KKjPlt63PDaP7nkNdIpFqg.gRannlfRLtnLsxd1HStMcp1WKibSEO2GJ79rOXts_td5Rgr6ztFAVwbEV9h9H8YYYzz-lZMOIjM33VN_6U5EQsYCMcrC9MFCXNffuH5XjaT3VWY8zJ2DSx0WfIA6PapcsGZ5fxJc2YCFRF9tNjd7nJZyWFrFrEYwcYNBIx5n7-83HZ_y83u6lTvw_pk1xIQmUfrjqOtfZNZEVFCIhQvE1XZ0qF1LuKBd7VE9ulE6-faFB-OB7tKsW0-JN7j_1Az42W5xXMMWGpyVA8ruj9SF9Q.AX3yjWLdWygMH5AJZJRIYZW3qmyg3Teai2D_cHySaPg; xzz-qyq=__admin__; xzz-qyx=jiYK6sXkf00nzfR8CNpTZNKK"
skill\m4-entity\scripts\m4-entity.bat get <业务对象名>
```

已知业务对象名称时必须优先使用 `get`。脚本仍然调用 `GET /api/meta/entities`，但会在本地完整读取响应后，只输出指定名称的业务对象配置，避免把全部业务对象内容传入 Skill 上下文。

### 查询全部业务对象

```bat
skill\m4-entity\scripts\m4-entity.bat list
```

只有用户明确要求查看全部业务对象，或需要确认业务对象名称时才使用 `list`。该命令会输出全部配置，数据量较大时终端可能显示截断。

### 修改或创建业务对象

修改前必须先执行 `get` 获取当前完整配置。修改后，再将完整配置保存为临时 JSON，再执行：

```bat
skill\m4-entity\scripts\m4-entity.bat save <json文件路径>
```

创建和修改使用同一个接口。请求体必须是完整业务对象配置，并且必须包含非空的 `name` 字段。

## 配置修改规则

1. 先查询，再修改；不要直接凭空生成已有业务对象的完整配置。
2. 只修改明确要求修改的字段，其他配置不修改。
3. 不要删除系统已有字段、页面按钮、状态、类型或操作配置。
4. 修改 `fields` 时，同时检查字段本身和字段的 `view` 配置。
5. 修改编号规则时，重点检查 `idGen.enabled`、`idGen.fixedPrefix` 和 `idGen.flowNoWidth`。
6. 保存返回 HTTP `200` 才能判定成功；失败时保留接口错误信息。
7. 保存后需要确认结果时，重新执行 `get` 并核对目标字段。

## 认证与环境

脚本默认连接 `http://127.0.0.1:5800`，可以通过环境变量覆盖：
请求头需添加：`xyy-app-id` 和 `xyy-app-key`，测试时统一使用 `test`。

```bat
set M4_BASE_URL=http://127.0.0.1:5800
set M4_APP_ID=test
set M4_APP_KEY=test
```

脚本每次请求都会自动添加以下请求头：

```http
xyy-app-id: test
xyy-app-key: test
```

```bat
skill\m4-entity\scripts\m4-entity.bat list
```
