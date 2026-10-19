"""Vercel Serverless Function: OpenDART company search + report readiness.

Environment variable required:
  OPENDART_API_KEY (preferred) or DART_API_KEY

GET /api/dart-company-search?q=삼성
  -> searches the full OpenDART corporation-code registry

GET /api/dart-company-search?corp_code=00126380
  -> returns recent periodic disclosures used by AI Promise readiness checks
"""
import io
import json
import os
import zipfile
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse, urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

_CORPS = None

def _json(handler, status, payload):
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "public, max-age=60, s-maxage=600")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(raw)

def _key():
    return os.environ.get("OPENDART_API_KEY") or os.environ.get("DART_API_KEY")

def _fetch_json(url):
    req = Request(url, headers={"User-Agent": "AI-Promise/1.0"})
    with urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

def _load_corps(key):
    global _CORPS
    if _CORPS is not None:
        return _CORPS
    url = "https://opendart.fss.or.kr/api/corpCode.xml?" + urlencode({"crtfc_key": key})
    req = Request(url, headers={"User-Agent": "AI-Promise/1.0"})
    with urlopen(req, timeout=25) as r:
        blob = r.read()
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        xml_name = zf.namelist()[0]
        xml_blob = zf.read(xml_name)
    root = ET.fromstring(xml_blob)
    corps = []
    for item in root.findall("list"):
        corp_code = (item.findtext("corp_code") or "").strip()
        corp_name = (item.findtext("corp_name") or "").strip()
        stock_code = (item.findtext("stock_code") or "").strip()
        modify_date = (item.findtext("modify_date") or "").strip()
        if corp_code and corp_name:
            corps.append({
                "corp_code": corp_code,
                "corp_name": corp_name,
                "stock_code": stock_code,
                "listed": bool(stock_code),
                "modify_date": modify_date,
            })
    _CORPS = corps
    return _CORPS

def _search_corps(key, q):
    qn = "".join(q.lower().split())
    hits = []
    for c in _load_corps(key):
        nn = "".join(c["corp_name"].lower().split())
        if qn in nn:
            score = 0 if nn == qn else (1 if nn.startswith(qn) else 2)
            hits.append((score, 0 if c["listed"] else 1, len(c["corp_name"]), c))
    hits.sort(key=lambda x: (x[0], x[1], x[2], x[3]["corp_name"]))
    return [x[3] for x in hits[:12]]

def _reports(key, corp_code):
    params = {
        "crtfc_key": key,
        "corp_code": corp_code,
        "bgn_de": "20250101",
        "end_de": "20261019",
        "pblntf_ty": "A",
        "page_count": "100",
    }
    data = _fetch_json("https://opendart.fss.or.kr/api/list.json?" + urlencode(params))
    status = data.get("status")
    if status not in (None, "000", "013"):
        raise RuntimeError(data.get("message") or ("OpenDART status " + str(status)))
    rows = data.get("list") or []
    reports = []
    for row in rows:
        name = row.get("report_nm") or ""
        if "사업보고서" not in name and "반기보고서" not in name:
            continue
        rcp = row.get("rcept_no") or ""
        reports.append({
            "report_nm": name,
            "rcept_no": rcp,
            "rcept_dt": row.get("rcept_dt") or "",
            "flr_nm": row.get("flr_nm") or "",
            "url": ("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + rcp) if rcp else "",
        })
    def has(term, year):
        return any(term in r["report_nm"] and str(year) in r["report_nm"] for r in reports)
    # Filing names do not always include the business year, so also infer from filing dates.
    def filed_between(start, end, term):
        return any(term in r["report_nm"] and start <= r["rcept_dt"] <= end for r in reports)
    readiness = {
        "promise_2024_business": filed_between("20250101", "20250531", "사업보고서"),
        "evidence_2025_business": filed_between("20260101", "20260531", "사업보고서"),
        "evidence_2026_half": filed_between("20260701", "20260930", "반기보고서"),
    }
    readiness["ready_for_deep_analysis"] = all(readiness.values())
    return reports[:20], readiness

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        key = _key()
        if not key:
            return _json(self, 503, {
                "ok": False,
                "code": "DART_KEY_MISSING",
                "message": "Vercel 환경변수 OPENDART_API_KEY가 설정되지 않았습니다."
            })
        qs = parse_qs(urlparse(self.path).query)
        try:
            corp_code = (qs.get("corp_code") or [""])[0].strip()
            if corp_code:
                reports, readiness = _reports(key, corp_code)
                return _json(self, 200, {
                    "ok": True,
                    "corp_code": corp_code,
                    "reports": reports,
                    "readiness": readiness,
                })

            q = (qs.get("q") or [""])[0].strip()
            if len(q) < 2:
                return _json(self, 200, {"ok": True, "query": q, "companies": []})
            return _json(self, 200, {
                "ok": True,
                "query": q,
                "companies": _search_corps(key, q),
            })
        except Exception as e:
            return _json(self, 502, {
                "ok": False,
                "code": "DART_UPSTREAM_ERROR",
                "message": str(e),
            })
