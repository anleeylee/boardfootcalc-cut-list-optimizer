# bfc-optimize — 切割清单 → 木材采购优化器

> 英文原版：[English](../README.md) · 在线计算器：[https://boardfootcalc.net](https://boardfootcalc.net/)

把一份木工切割清单变成优化过的、**废料最少**的木材采购方案。工具会把每个所需零件与你现有的库存和供应商板材进行匹配，在考虑锯缝（kerf）的前提下把零件排布到板材上，并用通俗文字解释每一块板、每一处排布和每一个未能满足的零件。

相关指南：Companion guide: [板尺切割清单计算器](https://boardfootcalc.net/board-foot-cut-list-calculator/) · See also [如何按板尺购买木材](https://boardfootcalc.net/how-to-buy-lumber-by-board-foot/) · and [木材浪费系数指南](https://boardfootcalc.net/lumber-waste-factor-guide/)。

## 功能

- **整板一维切割库存优化**：4 种策略（`lowest-cost` 最低成本、`lowest-waste` 最低废料、`min-boards` 最少板材、`balanced` 均衡）。
- **复用现有库存** — 优先使用状态为 AVAILABLE 的板材并按在库成本计价；供应商板材按成本/板尺 + 固定费用计价。
- **考虑锯缝** — 每对相邻零件之间都会消耗锯缝宽度，绝不忽略。
- **兼容性过滤** — 木种、厚度档（8/4 与 4/4）、宽度（纹理允许时可旋转）、纹理方向与净边要求。
- **缺陷区域** — 从可用板长中扣除标记的缺陷区域。
- **可解释** — 每块板的方案都会列出每个零件、其起始位置，以及未能满足的零件及其原因。
- **导出** — 采购清单 CSV、切割方案 JSON、项目文件（`.lumberproject`）。

## 安装

```bash
git clone <your-repo-url> 01-cut-list-purchase-optimizer
cd 01-cut-list-purchase-optimizer
npm install
npm run build        # 编译到 dist/
npm test             # 20 个测试
```

## 快速开始

```bash
npm run demo
bfc-optimize run --project myjob.lumberproject --strategy balanced --kerf 0.125 --waste 0.3
```

完整命令参考、输入格式与实现原理请见[英文 README](../README.md)。

## 计算引擎

本工具内置了共享的 [BoardFootCalc Desktop 木材计算引擎](https://boardfootcalc.net)
的冻结副本（位于 `src/core/`，涵盖板尺、单位、标称/实际厚度、四分之一厚度、
浪费系数、木种、计价与 CSV）。五个工具共用同一套数学逻辑，因此这里算出的数字
与网站上的在线计算器完全一致。

## 许可

MIT。估算结果仅供规划参考 — 采购前请与您的木材经销商核实尺寸、锯缝与价格。
