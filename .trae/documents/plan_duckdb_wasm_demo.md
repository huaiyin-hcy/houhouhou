# 摘要
在 Vue 3 (Vite) 项目中实现基于 `@duckdb/duckdb-wasm` 的数据操作演示，并配置 GitHub Pages 的自动化部署流程。

# 当前状态分析
*   **依赖状态**：当前项目尚未安装 `@duckdb/duckdb-wasm` 及其周边依赖（如 `apache-arrow` 用于解析查询结果）。
*   **页面状态**：`Home.vue` 目前仅包含一个极简的 `<template>`，需要重构为包含初始化、数据录入和查询展示的完整应用页面。
*   **部署配置**：`vite.config.js` 尚未配置 `base` 路径（GitHub Pages 需要与仓库名 `houhouhou` 一致），且缺乏对应的 `.github/workflows` 自动化部署脚本。

# 假设与决策
1.  **加载方式**：遵循您的选择，使用 jsdelivr CDN 动态拉取 WASM 和 Worker 核心文件，避免处理复杂的 Webpack/Vite 静态资源打包问题。
2.  **数据交互**：使用 `apache-arrow` 解析 DuckDB 返回的数据结构，将其转化为普通对象数组，并使用已安装的 `element-plus` 的 `<el-table>` 渲染。
3.  **代码风格**：严格遵循您的 `Vue 3 Composition API` 规范（包括统一在 `reactive` 中管理 DOM refs、提前返回、函数原子化、按规定顺序组织代码块）。
4.  **自动化部署**：使用 GitHub Actions 的通用静态部署流程，将构建后的 `dist` 目录推送到 `gh-pages` 分支。

# 提议的变更
## 1. 安装依赖 (`package.json`)
*   **操作**：执行 `npm install @duckdb/duckdb-wasm apache-arrow`。
*   **原因**：引入 DuckDB 核心库以及用于解析查询结果表结构的 Arrow 库。

## 2. 修改配置 (`vite.config.js`)
*   **操作**：在 `vite.config.js` 顶级配置中增加 `base: '/houhouhou/'`。
*   **原因**：确保部署到 GitHub Pages 时，静态资源的引用路径能够正确拼接上仓库名称前缀。

## 3. 编写核心页面 (`src/views/Home.vue`)
*   **操作**：重写 `Home.vue`。
*   **原因**：实现 DuckDB-WASM 演示的核心交互与逻辑。
*   **如何实现**：
    *   **依赖引入**：导入 `vue` 响应式 API、`@duckdb/duckdb-wasm` 和 `apache-arrow`。
    *   **DOM Refs**：定义 `const refs = reactive({})` 统一管理。
    *   **状态管理**：定义 `state` 对象（包含 `isReady` 准备状态、`isLoading` 加载状态、`error` 错误提示、`tableData` 数据集）。
    *   **核心逻辑**：
        1.  `initDB`: 通过 `getJsDelivrBundles` 拉取 CDN 资源，创建 Worker 和 `AsyncDuckDB` 实例并连接。
        2.  `createAndInsertData`: 使用 `conn.query()` 执行创建表（例如 `users`）并插入随机数据的 SQL 语句。
        3.  `fetchData`: 执行 `SELECT * FROM users`，使用 `toArray().map(r => r.toJSON())` 转换为普通数组供视图渲染。
    *   **视图层**：构建按钮组（初始化、写入数据、查询数据），并使用 Element Plus 的 `<el-table>` 绑定并展示 `state.tableData`。

## 4. 创建部署工作流 (`.github/workflows/deploy.yml`)
*   **操作**：新建自动化构建文件。
*   **原因**：实现代码提交后自动部署到 GitHub Pages。
*   **如何实现**：配置监听 `main` 分支的 push 事件。检出代码 -> 设置 Node 环境 -> 安装依赖 -> 运行 `npm run build` -> 使用 `peaceiris/actions-gh-pages@v3` 动作将 `dist` 推送到 `gh-pages` 分支。

# 验证步骤
1.  安装依赖并启动本地服务器 (`npm run dev`)。
2.  在浏览器中访问页面，依次点击“初始化”、“生成数据”，观察表格是否能正确显示被查出的数据。
3.  代码提交到 GitHub 后，前往 Actions 面板确认部署工作流是否运行成功。
4.  访问线上 GitHub Pages 链接：`https://huaiyinhcy.github.io/houhouhou/`，确认生产环境 DuckDB WASM 正常加载和运行。