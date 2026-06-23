"""Decodifica QR BNB y parsea payload EMV-QR (TLV)."""
import sys
import io
from PIL import Image
import cv2
import numpy as np

QR_PATH = r"D:\Claude\APPS\APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE\docs\qr-bnb-editable.png"

# Decodificar el QR con opencv
img = cv2.imread(QR_PATH)
det = cv2.QRCodeDetector()
data, points, _ = det.detectAndDecode(img)

if not data:
    # Fallback con pyzbar
    try:
        from pyzbar.pyzbar import decode
        pil = Image.open(QR_PATH)
        results = decode(pil)
        if results:
            data = results[0].data.decode("utf-8")
    except Exception as e:
        print(f"pyzbar fallback fail: {e}")

if not data:
    print("ERROR: no se pudo decodificar el QR")
    sys.exit(1)

print(f"=== PAYLOAD RAW ({len(data)} chars) ===")
print(data)
print()

# Parsear TLV EMV-QR
def parse_tlv(s, depth=0):
    i = 0
    out = []
    while i < len(s):
        if i + 4 > len(s):
            break
        tag = s[i:i+2]
        length = int(s[i+2:i+4])
        value = s[i+4:i+4+length]
        out.append((tag, length, value, depth))
        # Algunos tags son nested (26-51, 64-79)
        if 26 <= int(tag) <= 51 or 64 <= int(tag) <= 79 or tag == "62":
            try:
                nested = parse_tlv(value, depth + 1)
                out.extend(nested)
            except Exception:
                pass
        i += 4 + length
    return out

print("=== TLV PARSED ===")
fields = parse_tlv(data)
EMV_LABELS = {
    "00": "Payload Format Indicator",
    "01": "Point of Initiation Method (11=static, 12=dynamic)",
    "26": "Merchant Account Info (BNB)",
    "27": "Merchant Account Info 2",
    "28": "Merchant Account Info 3",
    "52": "Merchant Category Code",
    "53": "Transaction Currency (986=BOL?)",
    "54": "Transaction Amount",
    "55": "Tip / Convenience Indicator",
    "58": "Country Code",
    "59": "Merchant Name",
    "60": "Merchant City",
    "61": "Postal Code",
    "62": "Additional Data Field",
    "63": "CRC Checksum",
    "64": "Merchant Information — Language Template",
    "80": "RFU",
    "81": "RFU",
}
for tag, length, value, depth in fields:
    indent = "  " * depth
    label = EMV_LABELS.get(tag, "")
    preview = value[:80] + ("…" if len(value) > 80 else "")
    print(f"{indent}[{tag}] ({length:02d}) {preview}  {label}")

# Check campo 54 (monto)
monto_field = next((f for f in fields if f[0] == "54" and f[3] == 0), None)
if monto_field:
    print(f"\n💰 Monto detectado: '{monto_field[2]}'  (vacío/0 = editable)")
else:
    print("\n⚠️ Campo 54 (Transaction Amount) NO encontrado — QR sin amount")

# Check punto de inicio
poi = next((f for f in fields if f[0] == "01" and f[3] == 0), None)
if poi:
    poi_v = poi[2]
    print(f"📌 Point of Initiation: {poi_v}  ({'STATIC' if poi_v == '11' else 'DYNAMIC' if poi_v == '12' else 'unknown'})")

# Check CRC
crc = next((f for f in fields if f[0] == "63" and f[3] == 0), None)
if crc:
    print(f"🔐 CRC: {crc[2]}  (recalculable con CRC-16/CCITT-FALSE)")

# Check campo 62 (additional data) — puede tener firma o reference
addl = next((f for f in fields if f[0] == "62" and f[3] == 0), None)
if addl:
    print(f"\n📋 Campo 62 (Additional Data) presente — puede contener firma o transaction ref")
    print(f"   Raw: {addl[2]}")
