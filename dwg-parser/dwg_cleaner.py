import sys
import shutil
import os

def log(msg):
    print(f"[dwg_cleaner] {msg}", flush=True)

def main():
    if len(sys.argv) != 3:
        log("Usage: dwg_cleaner.py <input_path> <output_path>")
        return

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    log(f"🔍 Input path: {input_path}")
    log(f"📤 Output path: {output_path}")

    if not os.path.exists(input_path):
        log("❌ Input file does not exist.")
        return

    try:
        shutil.copyfile(input_path, output_path)
        log("✅ Input DWG file copied successfully as output with no modifications to input file")
    except Exception as e:
        log(f"⚠️ Failed to copy file: {e}")

if __name__ == "__main__":
    main()