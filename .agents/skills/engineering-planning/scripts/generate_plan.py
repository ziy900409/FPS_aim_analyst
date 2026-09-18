#!/usr/bin/env python3
import os
import sys

def generate_plan(feature_name):
    """
    根據工程規劃模板，產生一份新的 Tech Spec 草稿供填寫。
    """
    safe_name = "".join(c if c.isalnum() else "_" for c in feature_name)
    out_path = os.path.join(os.getcwd(), f"tech_spec_{safe_name}.md")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(script_dir, "..", "assets", "tech_spec_template.md")

    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except Exception as e:
        print(f"Error reading template: {e}")
        return

    header = f"# Feature: {feature_name}\n\n"

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(header + template)

    print(f"✅ Generated new Technical Specification draft at: {out_path}")
    print("Please fill in the details according to the Engineering Planning Skill guidelines.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_plan.py 'Feature Name'")
        sys.exit(1)

    generate_plan(sys.argv[1])