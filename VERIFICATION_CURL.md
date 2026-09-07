# Space Import API - Verification Guide

## Prerequisites
```bash
# Ensure API is running
pnpm dev:api
# API should be available at http://localhost:3000
```

## Step 1: Get a Project ID
```bash
curl -X GET http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer dev-token-change-me" | jq '.data[0].id'

# Example output: "clx1234567890"
# Export for convenience:
export PROJECT_ID="clx1234567890"
```

## Step 2: Download Template

### Request
```bash
curl -X GET http://localhost:3000/api/v1/spaces/template \
  -H "Authorization: Bearer dev-token-change-me" \
  -o space_template.xlsx

# Verify file was downloaded
ls -lh space_template.xlsx
file space_template.xlsx
```

### Expected Output
```
space_template.xlsx: Microsoft Excel 2007+
```

### Template Contents
The downloaded Excel file contains:

**Row 1 (Instructions):**
| Column A | Column B | Column C | Column D |
|----------|----------|----------|----------|
| 必填：空间名称 | 必填：楼栋\|楼层\|房间\|公区\|车位 | 可选：可用\|停用（默认可用） | 可选：父级空间名称（精确匹配；留空表示根级） |

**Row 2 (Headers):**
| name | type | status | parentName |
|------|------|--------|------------|

**Row 3-7 (Examples):**
| name | type | status | parentName |
|------|------|--------|------------|
| A栋 | 楼栋 | 可用 | |
| A栋1层 | 楼层 | 可用 | A栋 |
| A栋101 | 房间 | 可用 | A栋1层 |
| 公共区域 | 公区 | 可用 | |
| 车位A01 | 车位 | 可用 | |

## Step 3: Import Valid Data

### Request
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@space_template.xlsx" \
  -F "projectId=${PROJECT_ID}"
```

### Expected Success Response
```json
{
  "code": 0,
  "data": {
    "success": true,
    "imported": 5
  },
  "message": "操作成功"
}
```

## Step 4: Verify Imported Spaces

### Request
```bash
curl -X GET "http://localhost:3000/api/v1/spaces?projectId=${PROJECT_ID}&tree=true" \
  -H "Authorization: Bearer dev-token-change-me" | jq '.'
```

### Expected Response Structure
```json
{
  "code": 0,
  "data": {
    "id": "project_clx1234567890",
    "name": "测试项目",
    "type": "project",
    "isRoot": true,
    "children": [
      {
        "id": "space_001",
        "name": "A栋",
        "type": "楼栋",
        "status": "可用",
        "children": [
          {
            "id": "space_002",
            "name": "A栋1层",
            "type": "楼层",
            "status": "可用",
            "children": [
              {
                "id": "space_003",
                "name": "A栋101",
                "type": "房间",
                "status": "可用",
                "children": []
              }
            ]
          }
        ]
      },
      {
        "id": "space_004",
        "name": "公共区域",
        "type": "公区",
        "status": "可用",
        "children": []
      },
      {
        "id": "space_005",
        "name": "车位A01",
        "type": "车位",
        "status": "可用",
        "children": []
      }
    ]
  },
  "message": "操作成功"
}
```

## Step 5: Test Validation - Invalid Type Enum

### Create Test File
```bash
cat > invalid_type.csv << 'EOF'
name,type,status,parentName
B栋,楼栋,可用,
B栋无效,无效类型,可用,
EOF
```

### Request
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@invalid_type.csv" \
  -F "projectId=${PROJECT_ID}"
```

### Expected Error Response (with row number)
```json
{
  "code": 400,
  "message": {
    "message": "数据验证失败",
    "errors": [
      {
        "row": 4,
        "field": "type",
        "message": "无效的类型: 无效类型，必须是以下之一: 楼栋, 楼层, 房间, 公区, 车位"
      }
    ]
  }
}
```

**Note:** Row 4 = instruction row (1) + header row (2) + valid data row (3) + invalid data row (4)

### Verify Nothing Was Created (Transaction Rollback)
```bash
curl -X GET "http://localhost:3000/api/v1/spaces?projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer dev-token-change-me" | jq '.data[] | select(.name | startswith("B栋"))'
```

**Expected:** No output (empty result) - proving transaction rolled back

## Step 6: Test Validation - Invalid Status Enum

### Create Test File
```bash
cat > invalid_status.csv << 'EOF'
name,type,status,parentName
C栋,楼栋,无效状态,
EOF
```

### Request
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@invalid_status.csv" \
  -F "projectId=${PROJECT_ID}"
```

### Expected Error Response (with row number)
```json
{
  "code": 400,
  "message": {
    "message": "数据验证失败",
    "errors": [
      {
        "row": 3,
        "field": "status",
        "message": "无效的状态: 无效状态，必须是以下之一: 可用, 停用"
      }
    ]
  }
}
```

## Step 7: Test Validation - Missing Parent

### Create Test File
```bash
cat > missing_parent.csv << 'EOF'
name,type,status,parentName
孤儿房间,房间,可用,不存在的楼栋
EOF
```

### Request
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@missing_parent.csv" \
  -F "projectId=${PROJECT_ID}"
```

### Expected Error Response (with row number)
```json
{
  "code": 400,
  "message": {
    "message": "数据验证失败",
    "errors": [
      {
        "row": 3,
        "field": "parentName",
        "message": "父级空间不存在: 不存在的楼栋"
      }
    ]
  }
}
```

## Step 8: Test Transaction Rollback

### Create Test File (multiple rows, one invalid)
```bash
cat > rollback_test.csv << 'EOF'
name,type,status,parentName
D栋,楼栋,可用,
D栋1层,楼层,可用,D栋
D栋无效,错误类型,可用,D栋
D栋101,房间,可用,D栋1层
EOF
```

### Request
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@rollback_test.csv" \
  -F "projectId=${PROJECT_ID}"
```

### Expected Error Response
```json
{
  "code": 400,
  "message": {
    "message": "数据验证失败",
    "errors": [
      {
        "row": 5,
        "field": "type",
        "message": "无效的类型: 错误类型，必须是以下之一: 楼栋, 楼层, 房间, 公区, 车位"
      }
    ]
  }
}
```

### Verify ALL Rows Rolled Back (None Created)
```bash
curl -X GET "http://localhost:3000/api/v1/spaces?projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer dev-token-change-me" | jq '.data[] | select(.name | startswith("D栋"))'
```

**Expected:** No output - proves entire transaction rolled back despite 3 valid rows

## Step 9: Test Default Status

### Create Test File (no status column)
```bash
cat > default_status.csv << 'EOF'
name,type,status,parentName
E栋,楼栋,,
EOF
```

### Request
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@default_status.csv" \
  -F "projectId=${PROJECT_ID}"
```

### Expected Success Response
```json
{
  "code": 0,
  "data": {
    "success": true,
    "imported": 1
  },
  "message": "操作成功"
}
```

### Verify Default Status Applied
```bash
curl -X GET "http://localhost:3000/api/v1/spaces?projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer dev-token-change-me" | jq '.data[] | select(.name == "E栋")'
```

**Expected status:** `"可用"` (default value applied)

## Cleanup Test Data

```bash
# Get all imported space IDs
curl -X GET "http://localhost:3000/api/v1/spaces?projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer dev-token-change-me" | jq -r '.data[].id' > space_ids.txt

# Delete in reverse order (children first)
tac space_ids.txt | while read id; do
  curl -X DELETE "http://localhost:3000/api/v1/spaces/$id" \
    -H "Authorization: Bearer dev-token-change-me"
done
```

## Summary of Verification

✅ **Template Download** - Excel file with instructions + headers + examples
✅ **Valid Import** - Creates hierarchical spaces with parent references
✅ **Enum Validation** - Rejects invalid type/status with row numbers
✅ **Parent Validation** - Rejects missing parents with row numbers
✅ **Transaction Rollback** - All-or-nothing: any error = no data persisted
✅ **Default Values** - Empty status defaults to 可用
✅ **Error Messages** - Include specific row numbers for debugging
✅ **Response Format** - Follows {code, data, message} convention
✅ **Permission Check** - Requires config:write permission
✅ **Parent Resolution** - By exact name match (existing or same-import)
