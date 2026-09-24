# IFC Inspector — 5–10 Minute Presentation Script

> 用途：5–10 分钟比赛口头答辩。可直接朗读。每段末尾标注建议用时。

---

## 中文讲稿

### 开场（30 秒）

大家好，我是 IFC Inspector 的开发者。今天我们带来的项目是一个**纯浏览器端的 IFC 模型质检与信息泄露审计工具**。它的核心卖点很简单：把 IFC 文件拖进浏览器，所有解析、3D 预览、规则扫描和报告导出都在本地完成，**文件内容从不上传服务器**。在重视数据隐私的 AEC 交付场景中，这一点非常关键。

### Demo 演示（4 分钟）

#### 1. 加载内置样例模型（30 秒）

首先，我们不依赖用户上传文件。首页点击 "Load sample model"，系统会加载内置的开源 IFC 模型。大家可以立刻看到项目名、IFC schema（IFC2X3）、构件总数（21 个）和按类型统计的信息。

> 🎬 操作：点击 Load sample model，展示 3D 视图与左侧信息面板。

#### 2. 执行质检扫描（1 分钟）

点击 "Run QA Scan"，工具会分块异步扫描模型。扫描完成后，顶部出现综合健康分 70/100，以及 1 个错误、3 个警告、2 个提示的分布。我们故意用这个样例来展示真实问题：比如命名不符合 `类型-楼层-编号` 模式、部分构件缺少 `Pset_WallCommon`、以及 IfcRoof 缺少几何表示。

> 🎬 操作：点击 Run QA Scan，等待进度条完成，切换到 Report 视图。

#### 3. 点击问题高亮 3D 构件（1 分钟）

报告页最实用的功能是：点击任意一条问题，3D 视图会自动高亮对应构件并把相机推过去。这样审查人员不用在表格里手动查 GUID，而是**所见即所得**地定位问题。

> 🎬 操作：展开一条空几何或属性集缺失的问题，点击 GUID 定位到 3D。

#### 4. 导出报告（30 秒）

审查完成后，可以直接导出 JSON 或 CSV。JSON 便于接入下游系统，CSV 可以直接交给项目经理或业主查看。

> 🎬 操作：点击 Export JSON / Export CSV。

#### 5. 信息泄露审计页（1 分钟）

最后是本项目的差异化功能：隐私审计。这份 buildingSMART 官方开源样例里，实测检出了 3 处个人信息泄露——IfcPerson 中的作者姓名 "Jan B."，以及组织名称 "buildingSMART International" 和 "BIM-Tools"；文件头里还有导出时间戳 2026-06-23、导出软件 Sketchup-IFC-manager 5.6.0 和原始文件名。连官方示范文件都带着可识别的个人与组织信息，这正是这项功能存在的理由。工具会列出这些泄露项，并给出修复建议，比如"清除联系方式字段"、"重新导出时清空文件名元数据"。

> 🎬 操作：展开隐私审计规则，展示个人信息与元数据摘要。

### 开发过程（2 分钟）

这个项目是在 AI 辅助下分阶段完成的。我们的工作流可以总结为三点：

1. **Prompt 驱动**：先用明确的阶段拆分（F1 → F2 → F3 → F4 → F5）让 AI 建立项目骨架，而不是一开始就写全部代码。
2. **先跑通保底功能**：F1 的 3D 预览和样例模型是最核心的 demo 基础，必须先能编译、能渲染，再往上叠加规则引擎。
3. **AI 生成 + 人工审查修正**：规则引擎和隐私审计的代码由 AI 生成初稿后，我通过单元测试和真实 IFC 集成测试发现了不少假设错误——比如 `web-ifc` 的 `flatten=true` 返回的是内联实体而不是引用 ID，必须改成读取 `.expressID` 和直接访问 `.Name.value`。这些修正是人工完成的。

这套流程的好处是快：从脚手架到完整功能只用了一个下午；同时通过测试保留了对关键逻辑的信心。

### 最佳实践（1 分钟）

从这次开发里我们提炼出三条可复用的经验：

1. **先让保底功能可演示**：比赛评审第一件事是看能不能用。如果 3D 都加载不出来，后面的规则再漂亮也没用。
2. **规则引擎与 UI 解耦**：所有质检和隐私规则都是纯函数，输入 `IfcModelData`，输出 `RuleResult[]`。这样不仅好测试，也方便后续扩展新规则。
3. **为演示准备内置样例**：用户现场未必带了 IFC 文件。内置一个合法、有问题的开源样例，能确保 demo 稳定可控。

### 收尾（15 秒）

最后我想说，做 AEC 工具，**Idea is cheap, make it actually work**。IFC Inspector 不是一个概念，它已经是一个能构建、能测试、能跑 demo 的完整工具。我们相信"本地解析 + 隐私审计"的视角，会让它在 IFC 交付场景中真正有用。谢谢大家。

---

## English Script

### Opening (30 sec)

Hi, I’m the developer of IFC Inspector. Our project is a **browser-only IFC model QA and privacy-leak audit tool**. The core idea is simple: drop an IFC file into the browser, and all parsing, 3D preview, rule scanning, and report export happen **locally** — the file never reaches a server. That matters a lot in AEC delivery scenarios where model confidentiality is critical.

### Demo (4 min)

#### 1. Load the bundled sample model (30 sec)

First, we don’t rely on a user-provided file. On the landing page, click "Load sample model" and the app loads a bundled open-source IFC model. You immediately see the project name, the IFC2X3 schema, the total of 21 elements, and the type breakdown.

> 🎬 Action: Click Load sample model; show the 3D viewport and the info sidebar.

#### 2. Run the QA scan (1 min)

Click "Run QA Scan". The tool scans the model in chunked async steps. Once done, the overall health score of 70/100 appears, with 1 error, 3 warnings, and 2 infos. We deliberately use a sample with real issues: names that don’t follow the `type-floor-number` pattern, missing `Pset_WallCommon`, and an `IfcRoof` without geometry.

> 🎬 Action: Click Run QA Scan; wait for the progress bar; switch to the Report view.

#### 3. Click an issue to highlight the 3D element (1 min)

The most useful feature of the report page is that clicking any issue highlights the corresponding element in the 3D viewport and zooms the camera to it. Reviewers don’t have to look up GUIDs in a spreadsheet — they see the problem directly.

> 🎬 Action: Expand an empty-geometry or missing-property-set issue; click its GUID to fly to the 3D element.

#### 4. Export the report (30 sec)

After review, export JSON or CSV with one click. JSON is for downstream systems; CSV is for project managers or clients.

> 🎬 Action: Click Export JSON / Export CSV.

#### 5. Privacy audit page (1 min)

Finally, the feature that differentiates us: privacy audit. Even in this official buildingSMART sample file, the tool found 3 personal-data leaks — the author name "Jan B." in `IfcPerson`, plus the organizations "buildingSMART International" and "BIM-Tools" — and file-header metadata including the export timestamp 2026-06-23, the exporter "Sketchup-IFC-manager 5.6.0", and the original file name. If the official reference file carries identifiable personal and organizational data, that alone proves this audit is necessary. The tool lists each leak with concrete fix advice, such as “remove contact fields” or “strip file metadata on re-export.”

> 🎬 Action: Expand the privacy-audit rules; show personal info and metadata summary.

### Development Process (2 min)

This project was built in stages with AI assistance. Our workflow boils down to three points:

1. **Prompt-driven**: We split the work into clear phases (F1 → F2 → F3 → F4 → F5) so the AI could scaffold the project incrementally, rather than writing everything at once.
2. **Prove the baseline first**: F1 — upload and 3D preview with a sample model — was the foundation of the demo. It had to compile and render before adding rules on top.
3. **AI draft + human review**: The rule engine and privacy audit were AI-generated first, but manual review and real-IFC integration tests caught wrong assumptions — for example, `web-ifc` with `flatten=true` returns inlined entities, not reference IDs, so we had to read `.expressID` and access `.Name.value` directly. Those fixes were human-made.

This workflow is fast — from scaffold to full feature set in one afternoon — while tests kept confidence in the core logic.

### Best Practices (1 min)

Three takeaways from this build:

1. **Make the baseline demoable first**: The first thing judges check is whether it works. If 3D doesn’t load, rules don’t matter.
2. **Decouple rules from UI**: All QA and privacy rules are pure functions over `IfcModelData`, returning `RuleResult[]`. That makes them testable and easy to extend.
3. **Ship a built-in sample**: Users may not have an IFC file ready. A bundled open-source sample with real issues makes the demo stable and controllable.

### Closing (15 sec)

To close: in AEC tooling, **idea is cheap, make it actually work**. IFC Inspector is not a concept — it builds, it tests, and it runs. We believe the combination of local parsing and privacy auditing makes it genuinely useful for IFC delivery. Thank you.

---

*Presentation script generated for the IFC Inspector competition entry.*
