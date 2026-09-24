# IFC Inspector — Project Report

---

## 1. 一句话简介（中文版）

**IFC Inspector 是一个纯浏览器端的 IFC 模型质检与信息泄露审计工具，文件不上传服务器即可在本地完成 3D 预览、规则扫描与报告导出。**

## 1. One-liner (English)

**IFC Inspector is a browser-only IFC model QA and privacy-leak audit tool that parses, visualizes, scans, and reports entirely on the client — no file ever hits a server.**

---

## 2. 重建的对象与差异化价值

### 现有工作流

AEC 交付 IFC 模型时，常见流程是：

1. 用桌面 BIM 软件或 Solibri/Navisworks 打开模型做 clash / 信息检查；
2. 发现问题后在 Excel 里整理清单；
3. 对敏感信息（作者、软件版本、内部路径）的清理依赖人工抽查。

这个流程的问题是：

- 需要安装重客户端，不能随时随地审阅；
- 第三方审查工具通常需要上传模型，存在数据泄露风险；
- 隐私/信息泄露检查没有标准化规则，容易被忽略。

### IFC Inspector 重建了什么

我们把"打开模型 → 自动扫描 → 查看报告 → 导出结果"这条工作流搬到浏览器里，并针对**隐私安全**这个常被忽视的环节做了专门设计：

- **本地解析**：借助 web-ifc WebAssembly，IFC 文件在浏览器本地解析，避免上传到任何服务器。
- **实时 3D 联动**：点击质检问题即可高亮并聚焦到 3D 视口中的对应构件，审阅效率远高于纯表格。
- **隐私泄露审计**：自动识别文件头元数据、IfcPerson / IfcOrganization、Windows/UNC 路径和长文本字段，输出风险等级与修复建议。
- **零安装**：部署为静态站点 + Vercel serverless 函数，打开即用。

### 与现有工具的对比

| 维度 | Solibri / Navisworks | IFC Inspector |
|---|---|---|
| 部署方式 | 桌面软件，需安装 | 浏览器访问，无需安装 |
| 隐私模型 | 通常需要上传/共享模型 | 纯本地解析，文件不出浏览器 |
| 信息泄露审计 | 无专门规则 | 四类隐私规则，带修复建议 |
| 问题与 3D 联动 | 支持 | 点击问题直接高亮定位 |
| 报告导出 | PDF / BCF 等 | JSON / CSV，便于二次处理 |

---

## 3. 核心功能清单

### F1 — 文件上传与 3D 预览

拖拽或点击上传 `.ifc` 文件，使用 `@thatopen/components` 将其转换为 fragments 并在 Three.js 视口中渲染，支持旋转、缩放、平移。左侧信息面板显示项目名、IFC schema、构件总数、按 IFC 类型统计的数量和长度单位。内置一个样例 IFC（`public/samples/sample.ifc`，buildingSMART 开源样本，文件头为 `ISO-10303-21`），点击"Load sample model"即可无文件演示。

> 📸 截图占位符：首页拖拽上传区 + "Load sample model" 按钮

### F2 — 质检规则引擎

遍历 IFC 产品实体、Property Set 与 Relationship，输出每条规则的严重级别（error / warning / info）、问题数量和受影响 GUID 列表：

1. **GUID 重复检测**：全局唯一标识符重复 → error。
2. **属性集缺失检测**：按类型检查关键 Property Set（如 `Pset_WallCommon`）是否缺失 → warning，规则配置可扩展。
3. **命名规范检测**：Name / Description 为空 → warning；名称不符合 `类型-楼层-编号` 正则 → info。
4. **空几何检测**：IfcElement 等物理构件缺失 Representation → error；IfcZone / IfcGroup 等逻辑分组被排除。
5. **单位与坐标检查**：读取 IfcProject 的 UnitsInContext 与几何上下文，报告长度单位、角度单位与 Context → info。

> 📸 截图占位符：报告页顶部健康分与规则状态卡片

### F3 — 信息泄露审计

扫描 IFC 中可能泄露敏感信息的字段：

1. **个人信息**：IfcPerson / IfcOrganization 中的姓名、组织名称；字符串属性中的邮箱/电话模式。
2. **内部路径泄露**：所有字符串属性与文件头中匹配 Windows/UNC 路径的内容。
3. **注释与自由文本**：IfcPropertySingleValue 与长文本字段，列出原文供人工审阅。
4. **元数据摘要**：IFC 文件头（FILE_DESCRIPTION、FILE_NAME 等）中的导出软件、时间戳、作者、原始文件名。

每项结果标注：所在实体 GUID、字段路径、泄露内容片段、风险等级、修复建议。

> 📸 截图占位符：隐私审计规则展开后的问题明细

### F4 — 报告页与导出

扫描完成后切换到报告视图：顶部显示总体健康分（0–100）与 error/warning/info 计数；下方按规则分组列出问题明细；点击问题可高亮定位到 3D 构件。提供 Export JSON 与 Export CSV 按钮，一键下载完整报告。

> 📸 截图占位符：点击问题后 3D 视口中构件高亮

### F5 — AI 报告解读

 报告页底部提供 "AI Suggestions（AI 生成改进建议）" 按钮。点击后将质检报告 JSON POST 到 `/api/advise`，Vercel serverless 函数读取环境变量 `KIMI_API_KEY`，调用 Kimi（Moonshot）Chat Completions API（model: `kimi-k3`，baseURL `https://api.moonshot.cn/v1`），返回面向非技术用户的 3 条中文改进建议。若未配置 API Key，按钮会提示"未配置 API Key"而不是报错。API Key 只存在于服务端环境变量，不会出现在前端代码或 git 历史。

---

### 实测数据（基于内置样例 `sample.ifc` 的真实运行结果）

- 模型规格：IFC2X3 schema，共 21 个构件
- 综合健康分：**70 / 100**
- 问题总计：**1 个错误（error）、3 个警告（warning）、2 个提示（info）**
- 质检规则：单位与坐标检查通过；GUID 重复、属性集缺失、命名规范、空几何的具体命中数 [待补充]（*请对照报告界面核实后填入*）
- 信息泄露审计：
  - 个人信息审计：**3 个问题**——个人姓名 "Jan B."（IfcPerson #3）；组织名称 "buildingSMART International"（IfcOrganization #4）；组织名称 "BIM-Tools"（IfcOrganization #6）
  - 元数据摘要：**1 个问题**——文件头（HEADER/FILE_NAME、FILE_DESCRIPTION）含导出时间戳 `2026-06-23T11:53:12`、导出软件 `Sketchup-IFC-manager 5.6.0 / SketchUp 2026 (26.2.242)`、原始文件名 `Building-Architecture.ifc`
  - 内部路径泄露：通过（未检出）
  - 注释与自由文本：通过（未检出）

---

## 4. 技术架构

项目采用 Vite + React 18 + TypeScript 构建，IFC 解析使用 `web-ifc` WebAssembly，3D 渲染通过 `@thatopen/components` 生成 fragments 并交给 Three.js 绘制。规则引擎与隐私审计被设计为纯函数，输入统一的 `IfcModelData`，便于单元测试；UI 层只负责展示与交互。报告导出、AI 建议调用与 3D 高亮定位均通过组件与 `IfcViewer` 类封装，实现了解耦。

```
api/advise.ts                  Vercel serverless 函数（Kimi Chat Completions API）
public/samples/sample.ifc      内置演示 IFC 模型
public/wasm/                   web-ifc WASM 二进制
src/
  lib/
    ifc/
      model.ts                 web-ifc 提取 → IfcModelData（分块异步）
      rules.ts                 F2 质检规则（纯函数）
      privacy.ts               F3 隐私审计规则（纯函数）
      types.ts                 共享数据类型
      __tests__/               Vitest 单元 + 真实 IFC 集成测试
    viewer.ts                  @thatopen/components 3D 查看器 + GUID 高亮
    export.ts                  JSON / CSV 导出
  components/
    UploadZone.tsx             拖拽上传区
    InfoPanel.tsx              模型信息侧边栏
    Viewer.tsx                 3D 视口容器
    ReportView.tsx             报告视图 + AI 建议按钮
  App.tsx                      状态管理、扫描进度、视图切换
```

---

## 5. 差异化亮点：信息泄露审计

传统 IFC 检查工具关注几何正确性和属性完整性，却很少从**数据安全**角度审视模型。IFC 文件头、IfcPerson、IfcOrganization、Property 文本和文件导出历史里经常包含：

- 建模人员姓名、邮箱、电话；
- 公司内部组织名称；
- 原始文件路径（如 `C:\Users\zhangsan\...` 或 `\\server\project\...`）；
- 导出软件版本与时间戳；
- 项目内部备注或审校意见。

这些信息一旦随模型交付给业主或第三方，就可能暴露人员信息、软件栈、内部目录结构和项目时间线。

**现实佐证**：本项目的内置样例来自 buildingSMART 官方开源数据集，实测仍检出 3 处个人信息泄露（个人姓名 "Jan B."、组织名称 "buildingSMART International" 与 "BIM-Tools"）和 1 处文件头元数据泄露（导出时间戳、导出软件版本、原始文件名）。连官方示范文件都携带可识别的个人与组织信息，足以说明信息泄露审计不是理论需求。

IFC Inspector 把信息泄露审计作为一等公民功能：

- **自动扫描四类泄露**：个人信息、内部路径、长文本、文件头元数据；
- **每条结果给出修复建议**：例如"清除联系方式字段"、"删除本地/网络路径引用"、"重新导出时清空文件名元数据"；
- **与 3D 视图联动**：如果泄露项关联到具体构件，点击即可在模型中定位；
- **纯本地执行**：审计过程不上传文件，从根本上降低二次泄露风险。

> 📸 截图占位符：隐私审计规则中高亮的个人信息与文件头元数据

---

## 6. 已知问题与未来计划

### 已知问题

1. **3D 渲染未在 CI 中验证**：由于运行环境无 WebGL，3D 视口的实际渲染效果依赖本地/部署后手动验证。
2. **超大文件性能有上限**：`extractModelData` 使用 `GetLine(..., flatten=true)` 解析全部实体，50 MB 以上文件会明显变慢；当前通过 `setTimeout` 分块释放 UI，但未做 Web Worker 卸载。
3. **电话/邮箱正则仍有误报可能**：保守策略已要求电话以 `+` 或分隔符开头，但复杂 IFC 字符串仍可能出现少量误报。
4. **AI 建议依赖外部服务**：AI 建议使用 Kimi API（`kimi-k3`），需要有效的 `KIMI_API_KEY` 且产生 API 调用费用；未配置 Key 时降级为友好提示。
5. **界面语言混合**：部分按钮/提示同时出现中英文，决赛前可统一为全英文 UI + 中文报告内容。

### 未来计划

- 将 IFC 解析放入 Web Worker，避免主线程阻塞；
- 支持自定义规则配置 JSON 导入/导出；
- 增加 BCF 格式导出，便于与 BIM 协作平台对接；
- 补充更多隐私规则（IfcAddress、IfcTelecomAddress 等）；
- 增加模型对比功能，检测两次交付之间的 GUID/属性变化。

---

## 7. 运行与部署说明

### 本地运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 生产构建到 dist/
npm test           # Vitest 单元 + 集成测试
```

### 部署到 Vercel

1. 将代码推送到 GitHub/GitLab，导入到 Vercel。
2. Framework preset 选择 **Vite**（构建命令 `npm run build`，输出目录 `dist`），`api/advise.ts` 会自动被识别为 serverless 函数。
3. 如需启用 AI 建议：在 Vercel 项目 Settings → Environment Variables 中添加 `KIMI_API_KEY`。
4. 未配置 Key 时，前端按钮会显示"未配置 API Key"的降级提示，不会报错。

---

*Report generated for the IFC Inspector competition entry.*
