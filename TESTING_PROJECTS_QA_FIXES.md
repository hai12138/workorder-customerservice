# Manual Testing Guide: 项目管理 QA Fixes

This guide helps verify the fixes for the four QA regressions reported after PR #3.

## Prerequisites

1. Start the environment:
```bash
docker compose up -d
pnpm install
cd packages/workorder-api && npx prisma db push && npx prisma db seed && cd ../..
pnpm dev:api      # Terminal 1
pnpm dev:admin    # Terminal 2
```

2. Login at http://localhost:5173/login with `admin` / `dev`

## Test Cases

### ✅ Test 1: Scopebar Hiding

**Issue**: The project selector (scopebar) was visible on the projects page itself, which doesn't make sense since you're already managing the project list.

**Steps**:
1. Login and navigate to any page (e.g., Dashboard)
2. **Verify**: The scopebar (project selector dropdown) is visible at the top
3. Click on "项目管理" in the left menu
4. **Expected**: The scopebar should disappear/hide
5. Navigate to another page (e.g., "空间管理")
6. **Expected**: The scopebar should appear again

**Pass criteria**: Scopebar is hidden only on `#projects` page, visible on all other pages.

---

### ✅ Test 2: Create Project (projectForm is not a function)

**Issue**: Clicking "新建项目" threw "projectForm is not a function" error.

**Steps**:
1. Navigate to 项目管理 page
2. Click "新建项目" button
3. **Expected**: Modal should open without errors
4. Fill in the form:
   - 项目名称: "测试项目A" (required)
   - 地区: "华东"
   - 客服电话: "400-111-2222"
   - 项目负责人: "测试经理"
5. Click "保存"
6. **Expected**: Modal closes, success toast appears, project appears in list

**Pass criteria**: 
- Modal opens without console errors
- Form saves successfully
- All fields (name, region, phone, manager) are visible in the list

---

### ✅ Test 3: Edit Project (projectForm is not a function + values not pre-filled)

**Issue**: Clicking "编辑" also threw the same error, and even if it worked, the form wouldn't show existing values.

**Steps**:
1. In the projects list, click "编辑" on any project
2. **Expected**: Modal should open without errors
3. **Verify**: Form fields are pre-filled with existing values:
   - 项目名称: shows project name
   - 地区: shows existing region (if any)
   - 客服电话: shows existing phone (if any)
   - 项目负责人: shows existing manager (if any)
4. Change the region to "华南"
5. Click "保存"
6. **Expected**: Modal closes, success toast, list updates with new region

**Pass criteria**:
- Modal opens without console errors
- All existing values are pre-filled
- Changes are saved and reflected in the list

---

### ✅ Test 4: Region Column Shows Data (List 地区 still empty)

**Issue**: After creating a project with a region, the "地区" column in the list was empty. You had to edit the project a second time for it to show.

**Root cause**: The backend was putting region in `subtitle` instead of `values.region`, but the frontend table reads from `values.region`.

**Steps**:
1. Navigate to 项目管理 page
2. Click "新建项目"
3. Create a new project:
   - 项目名称: "区域测试项目"
   - 地区: "华北"
   - 客服电话: "400-333-4444"
   - 项目负责人: "李经理"
4. Click "保存"
5. **Expected**: The list should immediately show:
   - 项目名称: "区域测试项目"
   - 地区: "华北" ← **This should NOT be empty!**
   - 客服电话: "400-333-4444"
   - 项目负责人: "李经理"

**Pass criteria**: Region appears in the list column immediately after create, no need to edit a second time.

---

### ✅ Test 5: Combined Filter Query (Filters do not support combined query)

**Issue**: The filters (search + status + region) were not properly ANDed together. Using multiple filters might have used OR logic or ignored some params.

**Setup**:
1. Create test projects with different combinations:
   - Project A: name="华东项目", region="华东", status="服务中"
   - Project B: name="华南项目", region="华南", status="服务中"
   - Project C: name="华东测试", region="华东", status="筹备中"
   - Project D: name="华北项目", region="华北", status="服务中"

**Test Steps**:

#### Case 1: Single filter (query only)
1. Search: "华东"
2. Status: "全部状态"
3. Region: "全部地区"
4. Click "查询"
5. **Expected**: Shows Project A and C (both contain "华东" in name or region)

#### Case 2: Two filters (status + region)
1. Search: (empty)
2. Status: "服务中"
3. Region: "华东"
4. Click "查询"
5. **Expected**: Shows only Project A (status=服务中 AND region=华东)

#### Case 3: All three filters (query + status + region)
1. Search: "项目"
2. Status: "服务中"
3. Region: "华东"
4. Click "查询"
5. **Expected**: Shows only Project A (name contains "项目" AND status=服务中 AND region=华东)
6. Should NOT show:
   - Project B (wrong region)
   - Project C (wrong status)
   - Project D (wrong region)

#### Case 4: Reset filter
1. After any filter, click "重置"
2. **Expected**:
   - All input fields cleared
   - All dropdowns reset to "全部状态" / "全部地区"
   - Full list restored (all projects visible)

**Pass criteria**:
- Single filters work correctly
- Multiple filters use AND semantics (not OR)
- Reset clears all filters and shows full list
- Empty/default filter values are ignored

---

## Quick Smoke Test

If short on time, run this minimal test:

```bash
# Start environment (if not already running)
pnpm dev:api & pnpm dev:admin

# Open http://localhost:5173/login
# Login: admin / dev
```

1. **Check scopebar**: Navigate to 项目管理 → scopebar should hide
2. **Create project**: Click 新建项目 → form opens, fill and save → region visible in list
3. **Edit project**: Click 编辑 → form opens with pre-filled values, change region and save
4. **Filter test**: Use search + status + region together → results respect all filters

If all 4 pass, the fixes are working correctly.

## Debugging Tips

### If scopebar doesn't hide:
- Check browser console for JavaScript errors
- Verify `render()` function includes the scopebar hiding code
- Check that `current` variable equals `'projects'` when on that page

### If projectForm errors:
- Check console: "projectForm is not a function"
- Verify `projectForm` is defined as `function projectForm(rec) { ... }` not as a const
- Verify `esc()` function exists

### If region column is empty:
- Open browser DevTools → Network tab
- Look for `/workbench/bootstrap` or `/projects` response
- Check if `records.projects[0].values.region` exists (should not be undefined)
- If it's in `subtitle` instead, the backend fix wasn't applied

### If filters don't work:
- Check Network tab for `/projects?q=...&status=...&region=...` request
- Verify all params are sent
- Check response - should return filtered list
- Backend should use Prisma `AND` syntax, not top-level `where.OR`

## Expected Backend Changes

### File: `workbench.service.ts`

1. **In `loadAllCollections()`** (line ~163):
```typescript
projects: projects.map((p) =>
  entity(p.id, p.name, [p.region, p.status].filter(Boolean).join(' · '), p.status, {
    region: p.region ?? '—',  // ← Added
    manager: p.manager ?? '—',
    // ...
  }),
),
```

2. **In `queryProjects()`** (line ~795):
```typescript
async queryProjects(filters: { query?: string; status?: string; region?: string }) {
  const conditions: any[] = [];  // ← Changed from `where: any = {}`
  
  if (filters.query) {
    conditions.push({  // ← Changed from `where.OR = [...]`
      OR: [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { id: { contains: filters.query, mode: 'insensitive' } },
        { region: { contains: filters.query, mode: 'insensitive' } },
      ],
    });
  }
  
  if (filters.status && filters.status !== '全部状态') {
    conditions.push({ status: { contains: filters.status } });  // ← Changed
  }
  
  if (filters.region && filters.region !== '全部地区') {
    conditions.push({ region: { contains: filters.region } });  // ← Changed
  }
  
  const where = conditions.length > 0 ? { AND: conditions } : {};  // ← Added
  
  const projects = await this.prisma.project.findMany({ where, ... });
  
  return projects.map((p) =>
    entity(p.id, p.name, [...], p.status, {
      region: p.region ?? '—',  // ← Added
      manager: p.manager ?? '—',
      // ...
    }),
  );
}
```

## Expected Frontend Changes

### File: `prototype-main.js`

1. **In `render()`** (line ~206):
```javascript
function render() {
  // ... existing code ...
  
  // Hide scopebar on projects page (managing project list itself)
  const scopebar = document.querySelector('.scopebar')
  if (scopebar) {
    scopebar.style.display = current === 'projects' ? 'none' : ''
  }
  
  window.scrollTo(0, 0)
}
```

2. **Convert `projectForm` to function** (line ~278):
```javascript
// Before: const projectForm = `<form>...</form>`
// After:
function projectForm(rec) {
  return `<form id="demoForm">
    <div class="form-grid">
      <div class="form-row">
        <label>* 项目名称</label>
        <input id="f-title" required placeholder="例如：云栖雅苑" value="${rec ? esc(rec.title) : ''}">
      </div>
      <div class="form-row">
        <label>地区</label>
        <input id="f-region" placeholder="例如：华东 / 临江市" value="${rec?.values?.region || ''}">
      </div>
      <div class="form-row">
        <label>客服电话</label>
        <input id="f-phone" placeholder="例如：400-123-4567" value="${rec?.values?.phone || ''}">
      </div>
      <div class="form-row">
        <label>项目负责人</label>
        <input id="f-manager" placeholder="例如：张经理" value="${rec?.values?.manager || ''}">
      </div>
    </div>
  </form>`
}

function esc(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
```

## Summary

All four issues stem from the PR #3 merge:
1. **Scopebar hiding code** was deleted
2. **projectForm** was changed from function to const (lost edit functionality)
3. **esc()** helper was deleted (needed for XSS safety)
4. **Filter ANDing** was never fully correct (OR at top level)
5. **Region mapping** was in wrong place (subtitle instead of values)

The fixes restore the working state from PR #2 and properly implement the combined filter logic.
