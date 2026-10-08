# Changelog

## 交接時的狀態（2026-10-09）

- 規則引擎完成，`npm test` 8 項通過。
- Blender 場景、畫面端、村民、輸贏都還沒做。

## M0 環境確認（2026-10-09）

- 把交接的 zip 內容放進 repo（引擎、文件、critic 子代理設定）。
- Node v25.9.0、npm 11.12.1；`npm test` 8 項 PASS。
- Blender 5.2.2 LTS（內建 Python 3.13）在 `/Applications/Blender.app/Contents/MacOS/Blender`，不在 PATH。
- 已驗證：`--background --python` 可跑最小 bpy 腳本；`export_scene.gltf(export_format='GLB', export_extras=True)` 會把父物件的 `rb_*` 自訂屬性寫進節點 `extras`；Workbench 引擎可無介面算出 PNG。
- npm registry 可取得 three 0.186.1、vite 8.3.4、@playwright/test 1.64.0；本機已有 Playwright 的 chromium 快取。
- 技術選擇與各里程碑的驗證方式見 M0 回報，等使用者確認後開始 M1。
