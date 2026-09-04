#!/usr/bin/env python3
"""影片 → 關鍵幀 (P0)。

依序嘗試三個後端:系統 ffmpeg → imageio-ffmpeg 內建 ffmpeg → opencv-python。
三者皆無時**不硬解**,而是印出需要哪些鏡位的截圖清單,由使用者手動提供。

用法:
    python extract_frames.py <video> -o <outdir> [-n 12] [--start 0] [--end 0]

離開碼:0 = 抽幀成功;3 = 無可用後端(已印出截圖需求清單);2 = 用法/檔案錯誤。
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

SHOT_LIST = """
================ 需要的截圖(每類至少 1 張)================

  1. 正面 sightline —— 玩家視角看向主要交戰方向
     用途:距離級距、背景亮度與對比、目標可辨識度

  2. 掩體側視或斜視 —— 看得到掩體的側面與上緣
     用途:掩體型別(corner-peek / head-glitch / full / soft)、暴露側、關鍵高度

  3. 俯視 / 小地圖 / 空拍 —— 看得到平面關係
     用途:拓撲、走廊寬度
     ※ 只用來抽象成掩體原型,禁止逐點還原佈局(R1)

  4. 目標出現的瞬間 —— 敵人從掩體邊緣露出的那一幀
     用途:遮蔽關係、目標從哪個邊緣出現

存成 PNG/JPG 放進任一暫存資料夾(**不要放進 repo** —— 參考素材是他人著作),
把路徑給我即可。缺哪一類就說缺,我不會用推測補。
=========================================================
"""


def ffmpeg_binary() -> str | None:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def duration_via_ffprobe(video: str) -> float | None:
    exe = shutil.which("ffprobe")
    if not exe:
        return None
    try:
        out = subprocess.run(
            [exe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", video],
            capture_output=True, text=True, timeout=60,
        )
        return float(out.stdout.strip()) if out.returncode == 0 else None
    except Exception:
        return None


def extract_ffmpeg(exe: str, video: str, outdir: str, n: int, start: float, end: float) -> int:
    dur = end if end > 0 else duration_via_ffprobe(video)
    if dur and dur > start:
        # 均勻取樣:每 (dur-start)/n 秒一幀
        fps = n / (dur - start)
        vf = f"fps={fps:.6f}"
    else:
        # 拿不到長度就退回場景切換偵測 + 固定上限
        vf = "select='gt(scene,0.25)'"
        print("INFO  取不到影片長度(缺 ffprobe?),改用場景切換偵測。", file=sys.stderr)

    cmd = [exe, "-hide_banner", "-loglevel", "error", "-y"]
    if start > 0:
        cmd += ["-ss", str(start)]
    cmd += ["-i", video, "-vf", vf, "-vsync", "vfr",
            "-frames:v", str(n), os.path.join(outdir, "frame_%03d.png")]
    r = subprocess.run(cmd)
    return r.returncode


def extract_opencv(video: str, outdir: str, n: int, start: float, end: float) -> int:
    try:
        import cv2  # type: ignore
    except Exception:
        return -1
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        print(f"ERROR 無法開啟影片:{video}", file=sys.stderr)
        return 2
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    lo = int(start * fps)
    hi = int(end * fps) if end > 0 else total
    if hi <= lo:
        hi = total
    if hi <= 0:
        print("ERROR 讀不到影格數。", file=sys.stderr)
        return 2
    step = max(1, (hi - lo) // max(1, n))
    written = 0
    for i in range(n):
        cap.set(cv2.CAP_PROP_POS_FRAMES, lo + i * step)
        ok, frame = cap.read()
        if not ok:
            break
        cv2.imwrite(os.path.join(outdir, f"frame_{i + 1:03d}.png"), frame)
        written += 1
    cap.release()
    return 0 if written else 2


def main() -> int:
    ap = argparse.ArgumentParser(description="影片 → 關鍵幀")
    ap.add_argument("video")
    ap.add_argument("-o", "--outdir", required=True)
    ap.add_argument("-n", "--count", type=int, default=12)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=0.0)
    args = ap.parse_args()

    if not os.path.isfile(args.video):
        print(f"ERROR 找不到影片:{args.video}", file=sys.stderr)
        return 2
    os.makedirs(args.outdir, exist_ok=True)

    exe = ffmpeg_binary()
    if exe:
        print(f"INFO  後端:ffmpeg ({exe})")
        rc = extract_ffmpeg(exe, args.video, args.outdir, args.count, args.start, args.end)
    else:
        print("INFO  無 ffmpeg,改試 opencv-python。")
        rc = extract_opencv(args.video, args.outdir, args.count, args.start, args.end)
        if rc == -1:
            print("\n三個後端都不可用(系統 ffmpeg / imageio-ffmpeg / opencv-python)。")
            print("可安裝其中之一:  pip install imageio-ffmpeg   或   pip install opencv-python")
            print(SHOT_LIST)
            return 3

    frames = sorted(f for f in os.listdir(args.outdir) if f.lower().endswith((".png", ".jpg")))
    if rc != 0 or not frames:
        print("\n抽幀失敗。")
        print(SHOT_LIST)
        return 3

    print(f"\n✅ 抽出 {len(frames)} 幀 → {args.outdir}")
    for f in frames:
        print(f"  {f}")
    print("\n下一步:逐幀標註「屬於哪個鏡位 → 看得出什麼」,填進分析報告 §0。")
    print(SHOT_LIST)
    return 0


if __name__ == "__main__":
    sys.exit(main())
