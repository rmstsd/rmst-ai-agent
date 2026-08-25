# 业务对象 API 接口文档

本文档用于通过终端查询、创建和修改 M4 业务对象。

## 1. 接口概览

| 操作 | 方法 | 接口 | 说明 |
| --- | --- | --- | --- |
| 查询全部业务对象 | `GET` | `/api/meta/entities` | 返回全部业务对象配置 |


创建和修改使用同一个接口，服务端根据请求中的业务对象名称判断是修改还是更新。修改前必须先查询当前完整配置，避免覆盖未修改的字段。

接口完整地址：

```text
<M4_BASE_URL>/api/meta/entity
<M4_BASE_URL>/api/meta/entities
```

## 2. 请求头

测试环境可使用以下请求头：

```text
xyy-app-id: test
xyy-app-key: test
Content-Type: application/json
```

### 请求报文示例

下面的配置可作为生成业务对象 JSON 的结构参考。实际修改时，应先用查询结果作为基础，只修改用户要求的字段。

```json
{
  "name": "TestSkill",
  "label": "测试 skill",
  "group": "Dev",
  "builtin": false,
  "disabled": false,
  "otherDatasource": false,
  "type": "Entity",
  "fields": {
    "id": {
      "name": "id",
      "label": "ID",
      "type": "String",
      "scale": "Single",
      "inlineOptionBill": null,
      "refEntity": null,
      "disabled": false,
      "tip": null,
      "inputRequired": false,
      "fuzzyFilter": true,
      "defaultValue": null,
      "decimals": null,
      "refField": "",
      "refFieldField": "",
      "copiable": false,
      "sumLineField": "",
      "computed": "",
      "sqlType": "Varchar",
      "length": 50,
      "truncate": false,
      "numWidth": 0,
      "numScale": 0,
      "numDisplay": "None",
      "numDisplayDecimals": 0,
      "view": {
        "input": "",
        "specialInput": "",
        "specialInputArgs": null,
        "scan": null,
        "read": "Hidden",
        "create": "Hidden",
        "update": "Hidden",
        "displayOrder": 1,
        "block": false,
        "lineColumnWidth": 0,
        "listTableDisabled": false,
        "listTableColumnWidth": 0,
        "listTableColumnAlign": "",
        "timestampPrecision": null,
        "asTag": null,
        "sortAllowed": null,
        "trueText": null,
        "trueIcon": null,
        "trueStyle": null,
        "falseText": null,
        "falseIcon": null,
        "falseStyle": null
      },
      "refFilter": null,
      "fileMD5": false,
      "listItemNumMin": null,
      "listItemNumMax": null,
      "onChangeExt": null,
      "listBatchButtons": {
        "buttons": []
      },
      "deprecated": false,
      "disabledImport": false
    },
    "version": {
      "name": "version",
      "label": "修订版本",
      "type": "Int",
      "scale": "Single",
      "inlineOptionBill": null,
      "refEntity": null,
      "disabled": false,
      "tip": null,
      "inputRequired": false,
      "fuzzyFilter": false,
      "defaultValue": 0,
      "decimals": null,
      "refField": "",
      "refFieldField": "",
      "copiable": false,
      "sumLineField": "",
      "computed": "",
      "sqlType": "BigInt",
      "length": 0,
      "truncate": false,
      "numWidth": 0,
      "numScale": 0,
      "numDisplay": "None",
      "numDisplayDecimals": 0,
      "view": {
        "input": "",
        "specialInput": "",
        "specialInputArgs": null,
        "scan": null,
        "read": "Hidden",
        "create": "Hidden",
        "update": "Hidden",
        "displayOrder": 2,
        "block": false,
        "lineColumnWidth": 0,
        "listTableDisabled": false,
        "listTableColumnWidth": 0,
        "listTableColumnAlign": "",
        "timestampPrecision": null,
        "asTag": null,
        "sortAllowed": null,
        "trueText": null,
        "trueIcon": null,
        "trueStyle": null,
        "falseText": null,
        "falseIcon": null,
        "falseStyle": null
      },
      "refFilter": null,
      "fileMD5": false,
      "listItemNumMin": null,
      "listItemNumMax": null,
      "onChangeExt": null,
      "listBatchButtons": {
        "buttons": []
      },
      "deprecated": false,
      "disabledImport": false
    },
    "createdBy": {
      "name": "createdBy",
      "label": "创建人",
      "type": "Reference",
      "scale": "Single",
      "inlineOptionBill": null,
      "refEntity": "HumanUser",
      "disabled": false,
      "tip": null,
      "inputRequired": false,
      "fuzzyFilter": false,
      "defaultValue": null,
      "decimals": null,
      "refField": "",
      "refFieldField": "",
      "copiable": false,
      "sumLineField": "",
      "computed": "",
      "sqlType": "Varchar",
      "length": 50,
      "truncate": false,
      "numWidth": 0,
      "numScale": 0,
      "numDisplay": "None",
      "numDisplayDecimals": 0,
      "view": {
        "input": "",
        "specialInput": "",
        "specialInputArgs": null,
        "scan": null,
        "read": "Hidden",
        "create": "Hidden",
        "update": "Hidden",
        "displayOrder": 3,
        "block": false,
        "lineColumnWidth": 0,
        "listTableDisabled": false,
        "listTableColumnWidth": 0,
        "listTableColumnAlign": "",
        "timestampPrecision": null,
        "asTag": null,
        "sortAllowed": null,
        "trueText": null,
        "trueIcon": null,
        "trueStyle": null,
        "falseText": null,
        "falseIcon": null,
        "falseStyle": null
      },
      "refFilter": null,
      "fileMD5": false,
      "listItemNumMin": null,
      "listItemNumMax": null,
      "onChangeExt": null,
      "listBatchButtons": {
        "buttons": []
      },
      "deprecated": false,
      "disabledImport": false
    },
    "modifiedBy": {
      "name": "modifiedBy",
      "label": "最后修改人",
      "type": "Reference",
      "scale": "Single",
      "inlineOptionBill": null,
      "refEntity": "HumanUser",
      "disabled": false,
      "tip": null,
      "inputRequired": false,
      "fuzzyFilter": false,
      "defaultValue": null,
      "decimals": null,
      "refField": "",
      "refFieldField": "",
      "copiable": false,
      "sumLineField": "",
      "computed": "",
      "sqlType": "Varchar",
      "length": 50,
      "truncate": false,
      "numWidth": 0,
      "numScale": 0,
      "numDisplay": "None",
      "numDisplayDecimals": 0,
      "view": {
        "input": "",
        "specialInput": "",
        "specialInputArgs": null,
        "scan": null,
        "read": "Hidden",
        "create": "Hidden",
        "update": "Hidden",
        "displayOrder": 4,
        "block": false,
        "lineColumnWidth": 0,
        "listTableDisabled": false,
        "listTableColumnWidth": 0,
        "listTableColumnAlign": "",
        "timestampPrecision": null,
        "asTag": null,
        "sortAllowed": null,
        "trueText": null,
        "trueIcon": null,
        "trueStyle": null,
        "falseText": null,
        "falseIcon": null,
        "falseStyle": null
      },
      "refFilter": null,
      "fileMD5": false,
      "listItemNumMin": null,
      "listItemNumMax": null,
      "onChangeExt": null,
      "listBatchButtons": {
        "buttons": []
      },
      "deprecated": false,
      "disabledImport": false
    },
    "createdOn": {
      "name": "createdOn",
      "label": "创建时间",
      "type": "DateTime",
      "scale": "Single",
      "inlineOptionBill": null,
      "refEntity": null,
      "disabled": false,
      "tip": null,
      "inputRequired": false,
      "fuzzyFilter": false,
      "defaultValue": null,
      "decimals": null,
      "refField": "",
      "refFieldField": "",
      "copiable": false,
      "sumLineField": "",
      "computed": "",
      "sqlType": "DateTime",
      "length": 0,
      "truncate": false,
      "numWidth": 0,
      "numScale": 0,
      "numDisplay": "None",
      "numDisplayDecimals": 0,
      "view": {
        "input": "",
        "specialInput": "",
        "specialInputArgs": null,
        "scan": null,
        "read": "Hidden",
        "create": "Hidden",
        "update": "Hidden",
        "displayOrder": 5,
        "block": false,
        "lineColumnWidth": 0,
        "listTableDisabled": false,
        "listTableColumnWidth": 0,
        "listTableColumnAlign": "",
        "timestampPrecision": null,
        "asTag": null,
        "sortAllowed": null,
        "trueText": null,
        "trueIcon": null,
        "trueStyle": null,
        "falseText": null,
        "falseIcon": null,
        "falseStyle": null
      },
      "refFilter": null,
      "fileMD5": false,
      "listItemNumMin": null,
      "listItemNumMax": null,
      "onChangeExt": null,
      "listBatchButtons": {
        "buttons": []
      },
      "deprecated": false,
      "disabledImport": false
    },
    "modifiedOn": {
      "name": "modifiedOn",
      "label": "修改时间",
      "type": "DateTime",
      "scale": "Single",
      "inlineOptionBill": null,
      "refEntity": null,
      "disabled": false,
      "tip": null,
      "inputRequired": false,
      "fuzzyFilter": false,
      "defaultValue": null,
      "decimals": null,
      "refField": "",
      "refFieldField": "",
      "copiable": false,
      "sumLineField": "",
      "computed": "",
      "sqlType": "DateTime",
      "length": 0,
      "truncate": false,
      "numWidth": 0,
      "numScale": 0,
      "numDisplay": "None",
      "numDisplayDecimals": 0,
      "view": {
        "input": "",
        "specialInput": "",
        "specialInputArgs": null,
        "scan": null,
        "read": "Hidden",
        "create": "Hidden",
        "update": "Hidden",
        "displayOrder": 6,
        "block": false,
        "lineColumnWidth": 0,
        "listTableDisabled": false,
        "listTableColumnWidth": 0,
        "listTableColumnAlign": "",
        "timestampPrecision": null,
        "asTag": null,
        "sortAllowed": null,
        "trueText": null,
        "trueIcon": null,
        "trueStyle": null,
        "falseText": null,
        "falseIcon": null,
        "falseStyle": null
      },
      "refFilter": null,
      "fileMD5": false,
      "listItemNumMin": null,
      "listItemNumMax": null,
      "onChangeExt": null,
      "listBatchButtons": {
        "buttons": []
      },
      "deprecated": false,
      "disabledImport": false
    }
  },
  "indexes": [],
  "idGen": {
    "enabled": false,
    "fixedPrefix": "",
    "flowNoWidth": 4
  },
  "digest": {
    "fields": [],
    "formatJs": null
  },
  "scale": "Instances",
  "disabledFilter": false,
  "sort": "",
  "commentEnabled": false,
  "trash": false,
  "history": false,
  "trackChange": false,
  "userNotice": {
    "create": false,
    "update": false,
    "delete": false,
    "comment": false,
    "targetUserFields": []
  },
  "actions": {
    "createDisabled": false,
    "updateDisabled": false,
    "batchUpdateDisabled": false,
    "removeDisabled": true,
    "exportDisabled": false,
    "importDisabled": false
  },
  "listStats": {
    "items": []
  },
  "listCard": {
    "imageFieldName": null,
    "lines": []
  },
  "orderConfig": {
    "enabled": false,
    "states": [],
    "pushOrderStates": [],
    "pushOrders": [],
    "upOrderConfig": {
      "items": []
    },
    "thisQtyFields": [],
    "occurredQtyField": "",
    "planQtyField": "",
    "toCreateInv": false,
    "orderStatesToCreateInv": [],
    "toCreateInvState": null,
    "toAssignInv": false,
    "outboundInvAssignState": "",
    "outboundInvStates": [],
    "invRef": false,
    "invRefWarehouseHeadField": "",
    "invRefWarehouseLineField": "",
    "invRefDistrictHeadField": "",
    "invRefDistrictLineField": ""
  },
  "pagesButtons": {
    "ListMain": {
      "extEnabled": false,
      "buttons": []
    },
    "ListItem": {
      "extEnabled": false,
      "buttons": []
    },
    "View": {
      "extEnabled": false,
      "buttons": []
    },
    "Create": {
      "extEnabled": false,
      "buttons": []
    },
    "Edit": {
      "extEnabled": false,
      "buttons": []
    }
  },
  "codeParse": {
    "enabled": false,
    "rules": [],
    "addRow": false,
    "extJs": null
  },
  "dateClean": {
    "enabled": false,
    "type": "ByDay",
    "keepDays": null,
    "filter": null
  },
  "kinds": {
    "enabled": false,
    "kinds": {}
  },
  "states": {
    "enabled": false,
    "states": {}
  },
  "quickInput": {
    "enabled": false,
    "autoCommit": false,
    "items": []
  },
  "notMenu": false,
  "modifyProhibition": {
    "enabled": false,
    "type": "Query",
    "filter": null,
    "extFunction": null,
    "sourceLang": null,
    "source": null,
    "alertMsg": null
  },
  "removeProhibition": {
    "enabled": false,
    "type": "Query",
    "filter": null,
    "extFunction": null,
    "sourceLang": null,
    "source": null,
    "alertMsg": null
  },
  "multiSteps": {
    "enabled": false,
    "stateList": []
  },
  "inlineFilters": {
    "enable": false,
    "items": []
  },
  "deprecated": false
}
```

## 3. 查询业务对象

### 查询指定业务对象

查询接口一次返回全部业务对象，Skill 应从返回 JSON 中按 `name` 取出目标业务对象，而不是假设存在按名称查询的接口。

```bat
scripts\m4-entity.bat get <业务对象名>
```

### 查询全部业务对象

```bat
scripts\m4-entity.bat list
```

### 请求

```http
GET <M4_BASE_URL>/api/meta/entities
xyy-app-id: test
xyy-app-key: test
```

### 响应结构

返回值是以业务对象名称为键、业务对象配置为值的对象：

```json
{
  "AgentUser": {},
  "TestSkill": {}
}
```

其中每个值的结构与创建或修改接口的请求体相同。
