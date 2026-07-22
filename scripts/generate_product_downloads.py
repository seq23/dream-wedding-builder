#!/usr/bin/env python3
"""Manual/bootstrap generator for canonical Dream Wedding Builder downloads.

This script is intentionally quarantined from CI. Validation must read the
committed canonical files in product-builds/releases and the committed manifest;
it must not regenerate product assets.

Usage:
  python scripts/generate_product_downloads.py --verify-canonical
  python scripts/generate_product_downloads.py --refresh-manifest
  python scripts/generate_product_downloads.py --overwrite
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import sys
import zipfile
from pathlib import Path


VERSION = "2.0.0"
GENERATED_AT = "2026-07-10T21:50:51.773153+00:00"
DELIVERY = "private-r2-required"
FIXED_ZIP_DATE = (2026, 7, 10, 0, 0, 0)

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data/products/product_catalog.json"
RELEASE_DIR = ROOT / "product-builds/releases"
MANIFEST_PATH = ROOT / "product-builds/manifests/download_manifest.json"

SECTIONS = {
    "seating-chart-maker": [
        ("Guest Master List", ["Guest name", "Household/group", "RSVP status", "Meal choice", "Allergy or dietary note", "Accessibility need", "Child/high chair", "VIP/family note", "Table assignment", "Confirmed by"]),
        ("Table Inventory", ["Table number/name", "Shape", "Maximum capacity", "Reserved seats", "Assigned count", "Remaining seats", "Placement note"]),
        ("Social Group Map", ["Group name", "People included", "Keep together", "Separate from", "Placement priority", "Notes"]),
        ("Unassigned Guest Reconciliation", ["Confirmed guest", "Reason unassigned", "Decision owner", "Resolution deadline", "Final table"]),
        ("Venue Handoff", ["Table", "Capacity", "Assigned guests", "Special meals", "Accessibility needs", "Children/high chairs", "Venue note"]),
        ("Caterer Handoff", ["Guest", "Table", "Meal", "Allergy/dietary note", "Confirmed"]),
        ("Escort Card Export", ["Display name", "Table", "Meal marker", "Accessibility note", "Printed/ordered"]),
        ("Late Change Log", ["Date", "Guest/change", "Old assignment", "New assignment", "Who was notified", "Finalized by"]),
    ],
    "budget-spreadsheet": [
        ("Budget Control Summary", ["Category", "Target", "Estimated", "Contracted", "Paid", "Remaining", "Variance", "Owner"]),
        ("Vendor Cost Register", ["Vendor", "Category", "Proposal", "Contracted total", "Tax", "Service fee", "Delivery/setup", "Overtime", "Gratuity", "True total"]),
        ("Payment Calendar", ["Vendor", "Deposit due", "Deposit amount", "Progress payment", "Final due", "Final amount", "Paid status", "Payment method"]),
        ("Family Contributions", ["Contributor", "Pledged", "Received", "Restricted category", "Allocated", "Remaining", "Notes"]),
        ("Monthly Cash Flow", ["Month", "Starting cash", "Contributions expected", "Vendor payments due", "Other costs", "Ending cash need"]),
        ("Hidden Cost Review", ["Potential cost", "Expected?", "Estimate", "Confirmed amount", "Due date", "Owner"]),
        ("Scenario Comparison", ["Scenario", "Guest count", "Venue/catering", "Other categories", "Contingency", "Total", "Difference"]),
        ("Final Reconciliation", ["Budget", "Total contracted", "Total paid", "Remaining due", "Contingency remaining", "Projected final"]),
    ],
    "timeline-template": [
        ("Master Day Timeline", ["Time", "Location", "Event/action", "Owner", "People involved", "Dependency", "Buffer", "Confirmed"]),
        ("Vendor Arrival Schedule", ["Vendor", "Contact", "Arrival", "Setup start", "Ready by", "Breakdown", "Departure", "Handoff owner"]),
        ("Couple Timeline", ["Time", "Partner 1", "Partner 2", "Location", "Transportation", "Required items"]),
        ("Wedding Party Timeline", ["Time", "Group/member", "Action", "Location", "Owner/contact", "Required items"]),
        ("Photography Timeline", ["Time", "Photo block", "People needed", "Location", "Duration", "Must finish before"]),
        ("Family Photo Groupings", ["Group number", "People", "Meeting point", "Call time", "Photo order", "Released by"]),
        ("Setup and Breakdown", ["Item/area", "Delivery", "Setup owner", "Ready by", "Breakdown owner", "Pickup/return"]),
        ("Emergency Contacts", ["Role", "Name", "Phone", "Backup", "Authority/decision area"]),
        ("Change Control", ["Change", "Impact", "Decision owner", "People notified", "Final version time"]),
    ],
    "checklist-pdf": [
        ("Planning Profile", ["Wedding date", "Planning start", "Guest count", "Venue status", "Local/destination", "Planner/DIY", "Events included"]),
        ("Critical Path", ["Task", "Why it is critical", "Target date", "Dependency", "Owner", "Status"]),
        ("12-9 Months", ["Task", "Deadline", "Owner", "Dependency", "Status", "Notes"]),
        ("8-6 Months", ["Task", "Deadline", "Owner", "Dependency", "Status", "Notes"]),
        ("5-3 Months", ["Task", "Deadline", "Owner", "Dependency", "Status", "Notes"]),
        ("2-1 Months", ["Task", "Deadline", "Owner", "Dependency", "Status", "Notes"]),
        ("Wedding Week", ["Task", "Date/time", "Owner", "Handoff to", "Confirmed"]),
        ("Final Payments", ["Vendor", "Amount", "Due", "Payment method", "Owner", "Paid/receipt"]),
        ("Responsibility Matrix", ["Workstream", "Primary owner", "Backup", "Decision authority", "Handoff date"]),
        ("Post-Wedding Closeout", ["Task", "Deadline", "Owner", "Receipt/return", "Complete"]),
    ],
    "operations-suite": [
        ("Suite Control Center", ["Workstream", "Current status", "Next decision", "Owner", "Deadline", "Related product"]),
        ("Venue Comparison", ["Venue", "Capacity", "Base fee", "Food/beverage", "Service/tax", "Rentals", "True estimate", "Decision"]),
        ("Vendor Contact Register", ["Category", "Vendor", "Contact", "Contract status", "Next payment", "Final handoff", "Notes"]),
        ("Wedding Responsibility Matrix", ["Workstream", "Primary owner", "Backup", "Decision authority", "Deadline", "Status"]),
        ("Wedding Week Handoff", ["Date/time", "Action", "Owner", "Recipient", "File/item", "Confirmed"]),
        ("Emergency Contact Pack", ["Role", "Name", "Phone", "Backup", "Decision area"]),
        ("Final Readiness Review", ["Area", "Ready?", "Outstanding issue", "Owner", "Deadline", "Final proof"]),
    ],
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def catalog_products() -> list[dict]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))["products"]


def release_specs(product: dict) -> list[dict]:
    sku = product["sku"]
    specs = [
        {"path": f"{sku}_v{VERSION}.pdf", "content_type": "application/pdf"},
        {"path": f"{sku}_starter_v{VERSION}.csv", "content_type": "text/csv"},
    ]
    if product["id"] == "operations-suite":
        specs.append({"path": f"{sku}_complete_v{VERSION}.zip", "content_type": "application/zip"})
    else:
        specs.append({
            "path": f"{sku}_v{VERSION}.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
    return specs


def build_manifest() -> dict:
    manifest = {"version": VERSION, "generated_at": GENERATED_AT, "products": []}
    for product in catalog_products():
        files = []
        for spec in release_specs(product):
            release_path = RELEASE_DIR / spec["path"]
            if not release_path.exists():
                raise FileNotFoundError(f"Missing canonical release file: {release_path.relative_to(ROOT)}")
            files.append({
                "path": spec["path"],
                "sha256": sha256(release_path),
                "content_type": spec["content_type"],
                "delivery": DELIVERY,
            })
        manifest["products"].append({
            "product_id": product["id"],
            "sku": product["sku"],
            "version": VERSION,
            "files": files,
        })
    return manifest


def write_manifest() -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(build_manifest(), indent=2) + "\n", encoding="utf-8")


def verify_manifest() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    expected = build_manifest()
    if manifest != expected:
        raise RuntimeError("Canonical download manifest does not match committed release files")
    count = sum(len(product["files"]) for product in manifest["products"])
    if count != 15:
        raise RuntimeError(f"Expected 15 governed release files, found {count}")
    print(f"canonical product downloads: PASS ({count} files)")


def ensure_overwrite_allowed(paths: list[Path], overwrite: bool) -> None:
    existing = [path.relative_to(ROOT) for path in paths if path.exists()]
    if existing and not overwrite:
        joined = "\n- ".join(str(path) for path in existing)
        raise RuntimeError(
            "Refusing to overwrite canonical release assets without --overwrite:\n"
            f"- {joined}"
        )


def import_reportlab():
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.pdfgen import canvas
        from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError(
            "Manual PDF bootstrap requires reportlab. Install it locally only when regenerating products: "
            "python -m pip install reportlab"
        ) from exc
    return colors, TA_CENTER, letter, ParagraphStyle, getSampleStyleSheet, inch, canvas, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_pdf(product: dict, path: Path) -> None:
    colors, TA_CENTER, letter, ParagraphStyle, getSampleStyleSheet, inch, canvas, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle = import_reportlab()
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CenterTitle", parent=styles["Title"], alignment=TA_CENTER, fontSize=25, leading=29, spaceAfter=16, textColor=colors.HexColor("#2E2925")))
    styles.add(ParagraphStyle(name="Kicker", parent=styles["BodyText"], alignment=TA_CENTER, fontSize=8, leading=10, textColor=colors.HexColor("#776E67"), spaceAfter=8))
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=8, leading=11, textColor=colors.HexColor("#555555")))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading1"], fontSize=17, leading=21, textColor=colors.HexColor("#2E2925"), spaceAfter=10))
    styles.add(ParagraphStyle(name="Prompt", parent=styles["BodyText"], fontSize=9, leading=13, textColor=colors.HexColor("#443D38")))

    def deterministic_canvas(*args, **kwargs):
        kwargs.pop("invariant", None)
        kwargs.pop("pageCompression", None)
        return canvas.Canvas(*args, invariant=1, pageCompression=1, **kwargs)

    def table_block(title: str, cols: list[str], rows: int = 12) -> list:
        data = [[Paragraph(col, styles["Small"]) for col in cols]]
        data.extend([["" for _ in cols] for _ in range(rows)])
        width = 7.2 * inch / len(cols)
        table = Table(data, colWidths=[width] * len(cols), repeatRows=1, rowHeights=[0.34 * inch] + [0.36 * inch] * rows)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E9DDD0")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#2E2925")),
            ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#A79A90")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return [
            Paragraph(title, styles["Section"]),
            Paragraph("Complete this working page using verified information. Mark unresolved items clearly and name the person responsible for the next decision.", styles["Prompt"]),
            Spacer(1, 8),
            table,
            PageBreak(),
        ]

    story = [
        Paragraph(product["name"], styles["CenterTitle"]),
        Paragraph("A Dream Wedding Builder product", styles["Kicker"]),
        Paragraph("<b>Personal-use license and important limits</b>", styles["Section"]),
        Paragraph("Copyright 2026 Dream Wedding Builder. Licensed to the purchaser for personal use only. Do not resell, redistribute, sublicense, publish, share publicly, or repackage this product as a template.", styles["BodyText"]),
        Spacer(1, 8),
        Paragraph("This product is an educational and organizational aid. It is not legal, financial, tax, insurance, safety, accessibility, venue, dietary, medical, or professional wedding-planning advice. Verify all deadlines, prices, contracts, capacities, allergies, accessibility needs, local rules, vendor requirements, and event details with the relevant qualified professionals and providers. No outcome, savings, availability, accuracy, completeness, or vendor performance is guaranteed.", styles["BodyText"]),
        Spacer(1, 8),
        Paragraph("The purchaser is responsible for confirming the final information before sharing it with a venue, vendor, guest, family member, wedding party member, or other third party.", styles["BodyText"]),
        Spacer(1, 10),
        Paragraph(f"Support: info@weddingchecklistpdf.com | Version {VERSION} | Effective 2026-07-10", styles["Small"]),
        PageBreak(),
        Paragraph("How to use this product", styles["Section"]),
        Paragraph("Work from confirmed information. Keep assumptions visibly separate. Assign one owner to every unresolved item. Before the final handoff, reconcile totals, capacities, dates, dependencies, and contact information. Share one final version and keep a change log when updates occur.", styles["BodyText"]),
        Spacer(1, 12),
        Paragraph("Included working sections", styles["Section"]),
    ]
    for title, _cols in SECTIONS[product["id"]]:
        story.extend([Paragraph(f"- {title}", styles["BodyText"]), Spacer(1, 4)])
    story.append(PageBreak())
    for title, cols in SECTIONS[product["id"]]:
        story.extend(table_block(title, cols, 10 if len(cols) > 7 else 12))
    story.extend([
        Paragraph("Final verification and release", styles["Section"]),
        Paragraph("Do not distribute the final plan until each applicable item below is confirmed.", styles["BodyText"]),
        Spacer(1, 12),
    ])
    for check in [
        "Names and contact information checked",
        "Dates, times, travel, setup and breakdown checked",
        "Prices, taxes, fees, gratuities and payment terms checked",
        "Venue capacities, layouts and rules checked",
        "Dietary, allergy, accessibility and child needs checked",
        "Contracts and vendor requirements checked",
        "One final version named and shared",
        "Change owner and backup identified",
    ]:
        story.extend([Paragraph(f"[ ] {check}", styles["BodyText"]), Spacer(1, 7)])

    doc = SimpleDocTemplate(str(path), pagesize=letter, rightMargin=0.4 * inch, leftMargin=0.4 * inch, topMargin=0.45 * inch, bottomMargin=0.45 * inch)
    doc.build(story, canvasmaker=deterministic_canvas)


def generate_csv(product_id: str, path: Path) -> None:
    first_title, first_cols = SECTIONS[product_id][0]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(first_cols)


def xml_text(value: str) -> str:
    return html.escape(value, quote=True)


def worksheet_xml(sections: list[tuple[str, list[str]]]) -> str:
    rows = []
    row_index = 1
    for title, cols in sections:
        rows.append(f'<row r="{row_index}"><c r="A{row_index}" t="inlineStr"><is><t>{xml_text(title)}</t></is></c></row>')
        row_index += 1
        header_cells = []
        for col_index, col in enumerate(cols, start=1):
            cell_ref = f"{chr(64 + col_index)}{row_index}"
            header_cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{xml_text(col)}</t></is></c>')
        rows.append(f'<row r="{row_index}">{"".join(header_cells)}</row>')
        row_index += 2
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData>'
        + "".join(rows)
        + '</sheetData></worksheet>'
    )


def deterministic_zip_write(archive: zipfile.ZipFile, name: str, content: bytes | str) -> None:
    info = zipfile.ZipInfo(name, FIXED_ZIP_DATE)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    if isinstance(content, str):
        content = content.encode("utf-8")
    archive.writestr(info, content)


def generate_xlsx(product: dict, path: Path) -> None:
    product_id = product["id"]
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Workbook" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '</Relationships>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        '</Types>'
    )
    core = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        f'<dc:title>{xml_text(product["name"])}</dc:title>'
        '<dc:creator>Dream Wedding Builder</dc:creator>'
        '<cp:lastModifiedBy>Dream Wedding Builder</cp:lastModifiedBy>'
        '<dcterms:created xsi:type="dcterms:W3CDTF">2026-07-10T00:00:00Z</dcterms:created>'
        '<dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-10T00:00:00Z</dcterms:modified>'
        '</cp:coreProperties>'
    )
    app = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>Dream Wedding Builder</Application></Properties>'
    )
    with zipfile.ZipFile(path, "w") as archive:
        deterministic_zip_write(archive, "[Content_Types].xml", content_types)
        deterministic_zip_write(archive, "_rels/.rels", root_rels)
        deterministic_zip_write(archive, "docProps/app.xml", app)
        deterministic_zip_write(archive, "docProps/core.xml", core)
        deterministic_zip_write(archive, "xl/_rels/workbook.xml.rels", rels)
        deterministic_zip_write(archive, "xl/workbook.xml", workbook)
        deterministic_zip_write(archive, "xl/worksheets/sheet1.xml", worksheet_xml(SECTIONS[product_id]))


def generate_suite_zip(path: Path, generated_paths: list[Path]) -> None:
    included = sorted(item for item in generated_paths if item.name != path.name)
    with zipfile.ZipFile(path, "w") as archive:
        for release_path in included:
            info = zipfile.ZipInfo(release_path.name, FIXED_ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, release_path.read_bytes())


def generate_all(overwrite: bool) -> None:
    RELEASE_DIR.mkdir(parents=True, exist_ok=True)
    paths = [RELEASE_DIR / spec["path"] for product in catalog_products() for spec in release_specs(product)]
    ensure_overwrite_allowed(paths, overwrite)

    generated_paths: list[Path] = []
    suite_zip_path: Path | None = None
    for product in catalog_products():
        product_id = product["id"]
        sku = product["sku"]
        pdf_path = RELEASE_DIR / f"{sku}_v{VERSION}.pdf"
        csv_path = RELEASE_DIR / f"{sku}_starter_v{VERSION}.csv"
        generate_pdf(product, pdf_path)
        generate_csv(product_id, csv_path)
        generated_paths.extend([pdf_path, csv_path])
        if product_id == "operations-suite":
            suite_zip_path = RELEASE_DIR / f"{sku}_complete_v{VERSION}.zip"
        else:
            xlsx_path = RELEASE_DIR / f"{sku}_v{VERSION}.xlsx"
            generate_xlsx(product, xlsx_path)
            generated_paths.append(xlsx_path)

    if suite_zip_path is None:
        raise RuntimeError("Missing operations-suite product for suite ZIP generation")
    generate_suite_zip(suite_zip_path, generated_paths)
    write_manifest()
    verify_manifest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manual/bootstrap generator for Dream Wedding Builder canonical downloads.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--verify-canonical", action="store_true", help="Validate committed release files and manifest without mutation.")
    group.add_argument("--refresh-manifest", action="store_true", help="Recompute manifest from existing committed release files only.")
    group.add_argument("--overwrite", action="store_true", help="Regenerate all 15 canonical release files and manifest.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.verify_canonical:
            verify_manifest()
        elif args.refresh_manifest:
            write_manifest()
            verify_manifest()
        elif args.overwrite:
            generate_all(overwrite=True)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
