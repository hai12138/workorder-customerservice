# Space Import Feature Verification

## Overview
This feature implements template download and space import functionality for the Space API.

## Endpoints Added

### 1. Download Template
```bash
GET /api/v1/spaces/template
```

**Example curl:**
```bash
curl -X GET http://localhost:3000/api/v1/spaces/template \
  -H "Authorization: Bearer dev-token-change-me" \
  -o space_template.xlsx
```

### 2. Import Spaces
```bash
POST /api/v1/spaces/import
```

**Example curl:**
```bash
curl -X POST http://localhost:3000/api/v1/spaces/import \
  -H "Authorization: Bearer dev-token-change-me" \
  -F "file=@space_template.xlsx" \
  -F "projectId=<project-id>"
```

## Template Format

The Excel/CSV template has the following columns:

| Column | Required | Values | Description |
|--------|----------|--------|-------------|
| name | Yes | String | Space name |
| type | Yes | 楼栋, 楼层, 房间, 公区, 车位 | Space type (Chinese enum) |
| status | No | 可用, 停用 | Space status (defaults to 可用) |
| parentName | No | String | Parent space name (must exist) |

## Example Template Data

```csv
name,type,status,parentName
A栋,楼栋,可用,
A栋1层,楼层,可用,A栋
A栋101,房间,可用,A栋1层
公共区域,公区,可用,
车位A01,车位,可用,
```

## Validation Rules

1. **Required Fields**: `name` and `type` must be provided
2. **Enum Validation**: 
   - `type` must be one of: 楼栋, 楼层, 房间, 公区, 车位
   - `status` must be one of: 可用, 停用 (or empty for default)
3. **Parent Reference**: If `parentName` is provided, the parent must exist (either already in DB or created earlier in the same import)
4. **All-or-Nothing Transaction**: If ANY row fails validation, NO spaces are created
5. **Error Messages**: Include row numbers for easy identification

## Error Response Examples

### Invalid Enum
```json
{
  "code": 400,
  "message": {
    "message": "数据验证失败",
    "errors": [
      {
        "row": 3,
        "field": "type",
        "message": "无效的类型: 无效类型，必须是以下之一: 楼栋, 楼层, 房间, 公区, 车位"
      }
    ]
  }
}
```

### Missing Parent
```json
{
  "code": 400,
  "message": {
    "message": "数据验证失败",
    "errors": [
      {
        "row": 2,
        "field": "parentName",
        "message": "父级空间不存在: NonExistentParent"
      }
    ]
  }
}
```

## Test Coverage

The e2e test suite (`test/space-import.e2e-spec.ts`) covers:

1. ✅ Template download
2. ✅ Valid import with parent hierarchy
3. ✅ Import with existing parent spaces
4. ✅ Invalid type enum rejection with row number
5. ✅ Invalid status enum rejection with row number
6. ✅ Missing parent rejection with row number
7. ✅ All-or-nothing transaction (validation failures)
8. ✅ All-or-nothing transaction (parent not found during import)
9. ✅ Edge cases: empty file, missing columns, empty name
10. ✅ Default status when not provided

## Implementation Notes

- **No database migrations required**: Uses existing Space model
- **Parent resolution**: Supports both in-import parent names and existing DB parents
- **Transaction safety**: Uses Prisma `$transaction` for atomicity
- **File formats**: Supports both .xlsx and .csv (via xlsx library)
- **Response format**: Follows existing API conventions with {code, data, message}

## Files Changed

- `packages/workorder-api/package.json` - Added xlsx dependency
- `packages/workorder-api/src/modules/space/dto/import-space.dto.ts` - New DTO
- `packages/workorder-api/src/modules/space/space.controller.ts` - Added endpoints
- `packages/workorder-api/src/modules/space/space.service.ts` - Added import logic
- `packages/workorder-api/test/space-import.e2e-spec.ts` - Comprehensive e2e tests
- `pnpm-lock.yaml` - Updated dependencies

## No Migrations Required

The feature uses the existing Space table schema with no changes needed:
- `projectId`, `parentId`, `name`, `type`, `status`, `createdAt` - all existing fields
- Enum values already defined in Prisma schema
