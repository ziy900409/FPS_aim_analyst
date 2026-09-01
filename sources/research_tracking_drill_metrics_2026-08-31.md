# Tracking drill 與量化指標研究來源紀錄

_查詢日期：2026-08-31 · 用途：`docs/algorithm/tracking_pilot` 研究設計_

---

## 📋 查詢方法

- 本地 `parallel-cli` 不可用，因此改用工作階段提供的網路研究介面
- 優先保留原始研究論文、PubMed／PMC、出版社頁面與 DOI
- 查詢主題涵蓋：continuous manual pursuit、predictable vs. pseudorandom motion、position／velocity error、phase lag／gain、movement smoothness、moving-target size／speed，以及 cursor latency
- 本紀錄保存主文件實際使用的來源與可稽核摘要；搜尋結果中的同名 SPARC 天文／材料論文、Wikipedia、Reddit 與不相關工程 tracker 已排除

## 🔍 查詢字串

1. `pursuit tracking task manual control target trajectory position error velocity gain lag study`
2. `visuomotor tracking unpredictable target velocity acceleration continuous tracking study`
3. `spectral arc length SPARC movement smoothness original paper`
4. `continuous manual tracking task metrics RMS error time on target cross correlation coherence human operator paper`
5. `manual pursuit tracking sinusoidal pseudorandom target phase lag gain RMS error study`
6. `moving target pointing task target speed width acquisition performance mouse study`
7. `pursuit tracking task test retest reliability manual tracking psychomotor performance study`
8. `cursor latency visuomotor tracking DOI authors 2026`

## 📚 採用來源與研究用途

| 來源 | 可稽核重點 | 本文件用途 |
| --- | --- | --- |
| Philip et al. (2008), [Performance differences in visually- and internally-guided continuous manual tracking movements](https://pmc.ncbi.nlm.nih.gov/articles/PMC2574818/), DOI `10.1007/s00221-008-1489-3` | 逐 sample 計算 X/Y position error、X/Y velocity error、RMS position error；以 cursor/target velocity cross-correlogram 估 lag。Novel 與 Repeat 軌跡用來分離視覺導引與已學會的內部計畫 | 支持不能只看總分；應同時量 position error、velocity error 與 lag，且主測驗應避免重複可記憶路徑 |
| Parker et al. (2021), [Sensorimotor delays in tracking may be compensated by negative feedback control of motion-extrapolated position](https://pmc.ncbi.nlm.nih.gov/articles/PMC7884356/), DOI `10.1007/s00221-020-05962-0` | 比較單一 sinusoid 與 pseudorandom pursuit；分析 RMSE、phase lag 與 amplitude ratio。偽隨機條件的 delay 大於可預測 sinusoid；作者明確建議 spectral analysis 與 RMSE 並用以拆解 timing 與 amplitude error | 支持把 predictable calibration 與 unpredictable core assessment 分開；支持 lag／gain 不可被 RMS 取代 |
| Niehorster, Siu, and Li (2015), [Manual tracking enhances smooth pursuit eye movements](https://pmc.ncbi.nlm.nih.gov/articles/PMC4669211/), DOI `10.1167/15.15.11` | 使用不可預測的一維目標、position RMS error，以及多頻率 gain／phase 的 Bode 分析；hand tracking 的 phase lag 隨頻率增加 | 支持以帶限、多頻刺激估計 frequency-dependent gain／phase，並保留 1D 軸向診斷 |
| Turner et al. (2026), [The impact of varying cursor latency on visuomotor tracking](https://pubmed.ncbi.nlm.nih.gov/42068368/), DOI `10.1007/s00221-026-07291-0` | curvilinear pursuit 中操弄 0–300 ms cursor latency；較高或突變 latency 增加位置誤差與 corrective submovements，並改變 cursor velocity 頻譜 | 支持把 end-to-end latency、frame stability 與 input mode 當 eligibility／quality metadata，而不是選手能力 |
| Balasubramanian et al. (2015), [On the analysis of movement smoothness](https://pmc.ncbi.nlm.nih.gov/articles/PMC4674971/), DOI `10.1186/s12984-015-0090-9` | 提出 SPARC；相對 LDLJ 對 temporal scaling 與 noise 較穩健，但 smoothness 仍依賴一致的訊號處理與分析單位 | 支持 SPARC 作為研究向 movement-quality 指標，不作 tracking accuracy 主分數 |
| Lee and Hong (2022), [Time to Capture a Moving Target Travelling along a Circular Trajectory](https://www.mdpi.com/2076-3417/12/4/1911), DOI `10.3390/app12041911` | mouse moving-target acquisition 的受試者內設計同時操弄 target width、distance 與 speed；小 target／高 speed 會改變難度與 acquisition time | 支持以角尺寸 × 角速度建立受控難度矩陣，但該研究是 capture/click，不直接證明 continuous pursuit 指標 |
| Kryskow, Maule, and Ghajar (2013), [Dynamic visuomotor synchronization: Quantification of predictive timing](https://pmc.ncbi.nlm.nih.gov/articles/PMC3578718/), DOI `10.3758/s13428-012-0248-3` | 以動態視覺追蹤量化 prediction timing，並用 ICC 與 Bland–Altman 類方法檢查 test–retest reliability／repeatability | 支持 pilot 不只看條件敏感度，還要做跨 session 相對與絕對可靠度 |

## ⚠️ 證據邊界

- 多數基礎文獻使用手寫板、joystick 或眼手協同，不是 FPS mouse-look；本文件把它們當作量測原理來源，不把效果量直接移植成 FPS 常模
- moving-target capture 文獻主要量 acquisition/click；不能用來宣稱 continuous pursuit 的 TOT、RMS 或 lag 已被驗證
- smooth pursuit eye movement 與手部 cursor tracking 有耦合，但不是同一構念；眼動研究只用於解釋 predictable／unpredictable 與 gain／phase 的方法學選擇
- 所有 drill 數值均為 pilot candidate；必須由真人 floor／ceiling、可靠度與裝置條件測試後凍結

