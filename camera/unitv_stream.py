"""Live feed from the M5Stack UnitV (K210 / MaixPy) over USB serial.

Uploads a tiny capture loop to the camera through the MicroPython raw REPL,
reads the JPEG frames it sends back, and serves them as MJPEG at
http://localhost:8090.

    python3 -m venv camera/.venv && camera/.venv/bin/pip install pyserial
    camera/.venv/bin/python camera/unitv_stream.py [--port /dev/cu.usbserial-XXXX] [--baud 1500000]
"""
import argparse
import glob
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial

MAGIC = b"\xAA\x55FRM"

DEVICE_SCRIPT = """
import sensor, time, ustruct
from machine import UART
sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QVGA)
sensor.set_hmirror({mirror})
sensor.set_vflip({flip})
sensor.run(1)
sensor.skip_frames(10)
u = UART.repl_uart()
time.sleep_ms(300)
u.init({baud}, 8, None, 1, read_buf_len=2048)
while True:
    b = sensor.snapshot().compress(quality={quality}).to_bytes()
    u.write({magic!r} + ustruct.pack('<I', len(b)))
    u.write(b)
"""

PAGE = b"""<!doctype html><html><head><meta charset="utf-8"><title>UnitV Live</title>
<style>body{margin:0;background:#05080f;color:#7fe7ff;font:14px system-ui;display:grid;place-items:center;min-height:100vh}
img{width:min(96vw,960px);image-rendering:auto;border:1px solid #1d3a4a;border-radius:10px;box-shadow:0 0 30px #00e5ff33}
h1{font-size:15px;letter-spacing:.2em;font-weight:500}#fps{opacity:.7}</style></head>
<body><div><h1>&#9679; UNITV LIVE FEED <span id="fps"></span></h1><img src="/stream"></div>
<script>setInterval(()=>fetch('/fps').then(r=>r.text()).then(t=>fps.textContent=t+' fps'),1000)</script>
</body></html>"""

latest = {"jpg": None, "n": 0}
cond = threading.Condition()
fps = {"value": 0.0}


def find_port():
    ports = sorted(glob.glob("/dev/cu.usbserial-*"))
    if not ports:
        raise SystemExit("No /dev/cu.usbserial-* device found - is the UnitV plugged in?")
    return ports[0]


def _expect(s, send, want, tries):
    seen = b""
    for _ in range(tries):
        s.write(send)
        time.sleep(0.4)
        seen = (seen + s.read(s.in_waiting or 1))[-500:]
        if want in seen:
            return True
    return False


def start_camera(port, baud, quality, mirror, flip):
    s = serial.Serial(port, 115200, timeout=1)
    s.dtr = False
    s.rts = False
    # The UnitV may be running a saved boot script (or a previous stream at a
    # higher baud): keep interrupting until the REPL answers, then go raw.
    # Opening the port reboots the K210, so this also waits out the boot.
    # The saved line-follower script ignores Ctrl-C for ~10 s after boot.
    print("Waiting for camera to boot (~10 s)...")
    for _ in range(5):
        if not _expect(s, b"\x03\x03\x01", b"raw REPL; CTRL-B to exit\r\n>", 60):
            raise SystemExit("Camera REPL did not respond - unplug/replug the UnitV and retry")
        time.sleep(1.5)  # make sure it didn't reboot underneath us
        if b"init end" not in s.read(s.in_waiting or 0) and _expect(s, b"\x01", b"raw REPL", 3):
            break
    time.sleep(0.2)
    s.reset_input_buffer()
    code = DEVICE_SCRIPT.format(baud=baud, quality=quality, mirror=int(mirror), flip=int(flip), magic=MAGIC)
    for i in range(0, len(code), 256):
        s.write(code[i:i + 256].encode())
        time.sleep(0.02)
    s.write(b"\x04")  # execute
    time.sleep(0.15)
    s.baudrate = baud
    time.sleep(1.0)
    s.reset_input_buffer()
    return s


def reader(s):
    buf = bytearray()
    t0, count = time.time(), 0
    while True:
        buf += s.read(s.in_waiting or 1)
        while True:
            i = buf.find(MAGIC)
            if i < 0:
                del buf[:-len(MAGIC)]
                break
            if len(buf) < i + 9:
                break
            (n,) = struct.unpack("<I", buf[i + 5:i + 9])
            if n > 200_000:  # garbage header
                del buf[:i + 1]
                continue
            if len(buf) < i + 9 + n:
                break
            jpg = bytes(buf[i + 9:i + 9 + n])
            del buf[:i + 9 + n]
            if jpg[:2] == b"\xff\xd8":
                with cond:
                    latest["jpg"] = jpg
                    latest["n"] += 1
                    cond.notify_all()
                count += 1
        if time.time() - t0 >= 1:
            fps["value"] = count / (time.time() - t0)
            t0, count = time.time(), 0


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path == "/stream":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            seen = -1
            try:
                while True:
                    with cond:
                        cond.wait_for(lambda: latest["n"] != seen, timeout=5)
                        jpg, seen = latest["jpg"], latest["n"]
                    if jpg is None:
                        continue
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(jpg))
                    self.wfile.write(jpg + b"\r\n")
            except (BrokenPipeError, ConnectionResetError):
                return
        elif self.path == "/snapshot.jpg" and latest["jpg"]:
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.end_headers()
            self.wfile.write(latest["jpg"])
        elif self.path == "/fps":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"%.1f" % fps["value"])
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(PAGE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port")
    ap.add_argument("--baud", type=int, default=1500000)
    ap.add_argument("--quality", type=int, default=60)
    ap.add_argument("--mirror", action="store_true")
    ap.add_argument("--flip", action="store_true")
    ap.add_argument("--http", type=int, default=8090)
    a = ap.parse_args()

    port = a.port or find_port()
    print(f"UnitV on {port}, streaming at {a.baud} baud")
    s = start_camera(port, a.baud, a.quality, a.mirror, a.flip)
    threading.Thread(target=reader, args=(s,), daemon=True).start()
    print(f"Live feed: http://localhost:{a.http}")
    ThreadingHTTPServer(("0.0.0.0", a.http), Handler).serve_forever()


if __name__ == "__main__":
    main()
