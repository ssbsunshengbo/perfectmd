#!/usr/bin/env python3
from __future__ import annotations

import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ET.register_namespace("w", W_NS)


def w_tag(name: str) -> str:
    return f"{{{W_NS}}}{name}"


def w_attr(name: str) -> str:
    return f"{{{W_NS}}}{name}"


def get_or_create(parent: ET.Element, tag: str) -> ET.Element:
    child = parent.find(tag)
    if child is None:
        child = ET.SubElement(parent, tag)
    return child


def ensure_style(styles_root: ET.Element, style_type: str, style_id: str, display_name: str, based_on: str | None = None) -> ET.Element:
    for style in styles_root.findall(w_tag("style")):
        if style.get(w_attr("styleId")) == style_id:
            name = style.find(w_tag("name"))
            if name is None:
                name = ET.SubElement(style, w_tag("name"))
            name.set(w_attr("val"), display_name)
            return style

    style = ET.SubElement(styles_root, w_tag("style"))
    style.set(w_attr("type"), style_type)
    style.set(w_attr("styleId"), style_id)
    name = ET.SubElement(style, w_tag("name"))
    name.set(w_attr("val"), display_name)
    if based_on:
        based = ET.SubElement(style, w_tag("basedOn"))
        based.set(w_attr("val"), based_on)
    return style


def ensure_paragraph_style(styles_root: ET.Element, style_id: str, display_name: str, based_on: str = "Normal") -> ET.Element:
    style = ensure_style(styles_root, "paragraph", style_id, display_name, based_on)
    get_or_create(style, w_tag("qFormat"))
    return style


def ensure_character_style(styles_root: ET.Element, style_id: str, display_name: str, based_on: str = "DefaultParagraphFont") -> ET.Element:
    return ensure_style(styles_root, "character", style_id, display_name, based_on)


def ensure_table_style(styles_root: ET.Element, style_id: str, display_name: str, based_on: str = "TableNormal") -> ET.Element:
    return ensure_style(styles_root, "table", style_id, display_name, based_on)


def set_run_fonts(rpr: ET.Element, *, ascii_font: str | None = None, cs_font: str | None = None, east_asia_font: str | None = None) -> None:
    fonts = get_or_create(rpr, w_tag("rFonts"))
    if ascii_font:
        fonts.set(w_attr("ascii"), ascii_font)
        fonts.set(w_attr("hAnsi"), ascii_font)
    if cs_font:
        fonts.set(w_attr("cs"), cs_font)
    if east_asia_font:
        fonts.set(w_attr("eastAsia"), east_asia_font)


def set_font_size(rpr: ET.Element, half_points: int) -> None:
    size = get_or_create(rpr, w_tag("sz"))
    size.set(w_attr("val"), str(half_points))
    size_cs = get_or_create(rpr, w_tag("szCs"))
    size_cs.set(w_attr("val"), str(half_points))


def clear_attributes(element: ET.Element, *names: str) -> None:
    for name in names:
        element.attrib.pop(w_attr(name), None)


def set_run_color(rpr: ET.Element, color: str) -> None:
    color_el = get_or_create(rpr, w_tag("color"))
    color_el.set(w_attr("val"), color)
    clear_attributes(color_el, "themeColor", "themeTint", "themeShade")


def set_toggle(rpr: ET.Element, tag_name: str, enabled: bool) -> None:
    element = rpr.find(w_tag(tag_name))
    if enabled:
        if element is None:
            ET.SubElement(rpr, w_tag(tag_name))
    elif element is not None:
        rpr.remove(element)


def set_paragraph_spacing(ppr: ET.Element, *, before: int | None = None, after: int | None = None, line: int | None = None, line_rule: str | None = None) -> None:
    spacing = get_or_create(ppr, w_tag("spacing"))
    if before is not None:
        spacing.set(w_attr("before"), str(before))
    if after is not None:
        spacing.set(w_attr("after"), str(after))
    if line is not None:
        spacing.set(w_attr("line"), str(line))
    if line_rule is not None:
        spacing.set(w_attr("lineRule"), line_rule)


def set_paragraph_indent(ppr: ET.Element, *, left: int | None = None, right: int | None = None, first_line: int | None = None, hanging: int | None = None) -> None:
    indent = get_or_create(ppr, w_tag("ind"))
    if left is not None:
        indent.set(w_attr("left"), str(left))
    if right is not None:
        indent.set(w_attr("right"), str(right))
    if first_line is not None:
        indent.set(w_attr("firstLine"), str(first_line))
    if hanging is not None:
        indent.set(w_attr("hanging"), str(hanging))


def set_paragraph_shading(ppr: ET.Element, fill: str) -> None:
    shading = get_or_create(ppr, w_tag("shd"))
    shading.set(w_attr("val"), "clear")
    shading.set(w_attr("color"), "auto")
    shading.set(w_attr("fill"), fill)
    clear_attributes(shading, "themeFill", "themeFillTint", "themeFillShade")


def set_cell_shading(tc_pr: ET.Element, fill: str) -> None:
    shading = get_or_create(tc_pr, w_tag("shd"))
    shading.set(w_attr("val"), "clear")
    shading.set(w_attr("color"), "auto")
    shading.set(w_attr("fill"), fill)
    clear_attributes(shading, "themeFill", "themeFillTint", "themeFillShade")


def set_paragraph_border_box(ppr: ET.Element, color: str, size: int = 4) -> None:
    borders = get_or_create(ppr, w_tag("pBdr"))
    for edge_name in ("top", "left", "bottom", "right"):
        edge = get_or_create(borders, w_tag(edge_name))
        edge.set(w_attr("val"), "single")
        edge.set(w_attr("sz"), str(size))
        edge.set(w_attr("space"), "0")
        edge.set(w_attr("color"), color)


def set_left_border(ppr: ET.Element, color: str, size: int = 8) -> None:
    borders = get_or_create(ppr, w_tag("pBdr"))
    left = get_or_create(borders, w_tag("left"))
    left.set(w_attr("val"), "single")
    left.set(w_attr("sz"), str(size))
    left.set(w_attr("space"), "8")
    left.set(w_attr("color"), color)


def set_table_defaults(style: ET.Element) -> None:
    tbl_pr = get_or_create(style, w_tag("tblPr"))
    tbl_style_col_band = get_or_create(tbl_pr, w_tag("tblStyleColBandSize"))
    tbl_style_col_band.set(w_attr("val"), "1")
    tbl_style_row_band = get_or_create(tbl_pr, w_tag("tblStyleRowBandSize"))
    tbl_style_row_band.set(w_attr("val"), "1")
    tbl_look = get_or_create(tbl_pr, w_tag("tblLook"))
    tbl_look.set(w_attr("firstRow"), "1")
    tbl_look.set(w_attr("firstColumn"), "0")
    tbl_look.set(w_attr("lastRow"), "0")
    tbl_look.set(w_attr("lastColumn"), "0")
    tbl_look.set(w_attr("noHBand"), "1")
    tbl_look.set(w_attr("noVBand"), "1")
    tbl_look.set(w_attr("val"), "04A0")

    borders = get_or_create(tbl_pr, w_tag("tblBorders"))
    for edge_name in ("top", "left", "bottom", "right", "insideH", "insideV"):
        edge = get_or_create(borders, w_tag(edge_name))
        edge.set(w_attr("val"), "single")
        edge.set(w_attr("sz"), "6")
        edge.set(w_attr("space"), "0")
        edge.set(w_attr("color"), "CBD5E1")

    cell_mar = get_or_create(tbl_pr, w_tag("tblCellMar"))
    for side_name in ("top", "left", "bottom", "right"):
        side = get_or_create(cell_mar, w_tag(side_name))
        side.set(w_attr("w"), "108")
        side.set(w_attr("type"), "dxa")

    whole_table = None
    first_row = None
    band_one = None
    for candidate in style.findall(w_tag("tblStylePr")):
        kind = candidate.get(w_attr("type"))
        if kind == "wholeTable":
            whole_table = candidate
        elif kind == "firstRow":
            first_row = candidate
        elif kind == "band1Horz":
            band_one = candidate

    if whole_table is None:
        whole_table = ET.SubElement(style, w_tag("tblStylePr"))
        whole_table.set(w_attr("type"), "wholeTable")
    whole_table_tc_pr = get_or_create(whole_table, w_tag("tcPr"))
    set_cell_shading(whole_table_tc_pr, "FFFFFF")

    if first_row is None:
        first_row = ET.SubElement(style, w_tag("tblStylePr"))
        first_row.set(w_attr("type"), "firstRow")

    tc_pr = get_or_create(first_row, w_tag("tcPr"))
    set_cell_shading(tc_pr, "E2E8F0")

    rpr = get_or_create(first_row, w_tag("rPr"))
    set_toggle(rpr, "b", True)
    set_run_color(rpr, "111827")

    if band_one is None:
        band_one = ET.SubElement(style, w_tag("tblStylePr"))
        band_one.set(w_attr("type"), "band1Horz")
    band_one_tc_pr = get_or_create(band_one, w_tag("tcPr"))
    set_cell_shading(band_one_tc_pr, "F8FAFC")


def configure_styles(styles_xml: Path) -> None:
    tree = ET.parse(styles_xml)
    root = tree.getroot()

    doc_defaults = get_or_create(root, w_tag("docDefaults"))
    rpr_default = get_or_create(doc_defaults, w_tag("rPrDefault"))
    default_rpr = get_or_create(rpr_default, w_tag("rPr"))
    set_run_fonts(default_rpr, ascii_font="Aptos", cs_font="Aptos")
    set_font_size(default_rpr, 22)
    set_run_color(default_rpr, "1F2937")
    lang = get_or_create(default_rpr, w_tag("lang"))
    lang.set(w_attr("val"), "en-US")
    lang.set(w_attr("eastAsia"), "zh-CN")
    lang.set(w_attr("bidi"), "ar-SA")

    ppr_default = get_or_create(doc_defaults, w_tag("pPrDefault"))
    default_ppr = get_or_create(ppr_default, w_tag("pPr"))
    set_paragraph_spacing(default_ppr, after=120, line=336, line_rule="auto")

    normal = ensure_paragraph_style(root, "Normal", "Normal")
    normal_rpr = get_or_create(normal, w_tag("rPr"))
    set_run_fonts(normal_rpr, ascii_font="Aptos", cs_font="Aptos")
    set_font_size(normal_rpr, 22)
    set_run_color(normal_rpr, "1F2937")
    set_paragraph_spacing(get_or_create(normal, w_tag("pPr")), after=120, line=336, line_rule="auto")

    default_paragraph_font = ensure_character_style(root, "DefaultParagraphFont", "Default Paragraph Font")
    default_paragraph_font_rpr = get_or_create(default_paragraph_font, w_tag("rPr"))
    set_run_fonts(default_paragraph_font_rpr, ascii_font="Aptos", cs_font="Aptos")
    set_font_size(default_paragraph_font_rpr, 22)
    set_run_color(default_paragraph_font_rpr, "1F2937")

    body_text = ensure_paragraph_style(root, "BodyText", "Body Text")
    set_paragraph_spacing(get_or_create(body_text, w_tag("pPr")), after=120, line=336, line_rule="auto")

    first_paragraph = ensure_paragraph_style(root, "FirstParagraph", "First Paragraph")
    first_paragraph_ppr = get_or_create(first_paragraph, w_tag("pPr"))
    set_paragraph_spacing(first_paragraph_ppr, after=120, line=336, line_rule="auto")
    set_paragraph_indent(first_paragraph_ppr, first_line=0)

    compact = ensure_paragraph_style(root, "Compact", "Compact")
    set_paragraph_spacing(get_or_create(compact, w_tag("pPr")), after=60, line=320, line_rule="auto")

    title = ensure_paragraph_style(root, "Title", "Title")
    title_rpr = get_or_create(title, w_tag("rPr"))
    set_run_fonts(title_rpr, ascii_font="Aptos", cs_font="Aptos")
    set_font_size(title_rpr, 36)
    set_run_color(title_rpr, "111827")
    set_toggle(title_rpr, "b", True)
    title_ppr = get_or_create(title, w_tag("pPr"))
    set_paragraph_spacing(title_ppr, before=80, after=240, line=360, line_rule="auto")

    subtitle = ensure_paragraph_style(root, "Subtitle", "Subtitle")
    subtitle_rpr = get_or_create(subtitle, w_tag("rPr"))
    set_run_fonts(subtitle_rpr, ascii_font="Aptos", cs_font="Aptos")
    set_font_size(subtitle_rpr, 24)
    set_run_color(subtitle_rpr, "4B5563")
    subtitle_ppr = get_or_create(subtitle, w_tag("pPr"))
    set_paragraph_spacing(subtitle_ppr, after=180, line=320, line_rule="auto")

    for style_id, display_name, size, before, after in (
        ("Heading1", "Heading 1", 32, 240, 100),
        ("Heading2", "Heading 2", 28, 220, 90),
        ("Heading3", "Heading 3", 24, 180, 80),
    ):
        style = ensure_paragraph_style(root, style_id, display_name)
        rpr = get_or_create(style, w_tag("rPr"))
        set_run_fonts(rpr, ascii_font="Aptos", cs_font="Aptos")
        set_font_size(rpr, size)
        set_run_color(rpr, "111827")
        set_toggle(rpr, "b", True)
        ppr = get_or_create(style, w_tag("pPr"))
        set_paragraph_spacing(ppr, before=before, after=after, line=320, line_rule="auto")
        get_or_create(ppr, w_tag("keepNext"))

    for style_id, display_name, size in (
        ("Heading4", "Heading 4", 22),
        ("Heading5", "Heading 5", 21),
        ("Heading6", "Heading 6", 20),
    ):
        style = ensure_paragraph_style(root, style_id, display_name)
        rpr = get_or_create(style, w_tag("rPr"))
        set_run_fonts(rpr, ascii_font="Aptos", cs_font="Aptos")
        set_font_size(rpr, size)
        set_run_color(rpr, "111827")
        set_toggle(rpr, "b", True)
        ppr = get_or_create(style, w_tag("pPr"))
        set_paragraph_spacing(ppr, before=160, after=60, line=320, line_rule="auto")

    block_text = ensure_paragraph_style(root, "BlockText", "Block Text")
    block_rpr = get_or_create(block_text, w_tag("rPr"))
    set_run_fonts(block_rpr, ascii_font="Aptos", cs_font="Aptos")
    set_font_size(block_rpr, 21)
    set_run_color(block_rpr, "374151")
    block_ppr = get_or_create(block_text, w_tag("pPr"))
    set_paragraph_spacing(block_ppr, before=120, after=120, line=336, line_rule="auto")
    set_paragraph_indent(block_ppr, left=420)
    set_left_border(block_ppr, "CBD5E1", size=10)

    source_code = ensure_paragraph_style(root, "SourceCode", "Source Code", based_on="Normal")
    source_rpr = get_or_create(source_code, w_tag("rPr"))
    set_run_fonts(source_rpr, ascii_font="Consolas", cs_font="Consolas")
    set_font_size(source_rpr, 22)
    set_run_color(source_rpr, "111827")
    source_ppr = get_or_create(source_code, w_tag("pPr"))
    set_paragraph_spacing(source_ppr, before=80, after=80, line=264, line_rule="auto")
    set_paragraph_indent(source_ppr, left=240, right=0)
    set_paragraph_shading(source_ppr, "F8FAFC")
    set_paragraph_border_box(source_ppr, "E5E7EB", size=6)

    verbatim_char = ensure_character_style(root, "VerbatimChar", "Verbatim Char")
    verbatim_rpr = get_or_create(verbatim_char, w_tag("rPr"))
    set_run_fonts(verbatim_rpr, ascii_font="Consolas", cs_font="Consolas")
    set_font_size(verbatim_rpr, 22)
    set_run_color(verbatim_rpr, "111827")

    for style_id, display_name in (
        ("Caption", "Caption"),
        ("TableCaption", "Table Caption"),
        ("ImageCaption", "Image Caption"),
    ):
        style = ensure_paragraph_style(root, style_id, display_name)
        rpr = get_or_create(style, w_tag("rPr"))
        set_run_fonts(rpr, ascii_font="Aptos", cs_font="Aptos")
        set_font_size(rpr, 18)
        set_run_color(rpr, "6B7280")
        set_toggle(rpr, "i", True)
        ppr = get_or_create(style, w_tag("pPr"))
        set_paragraph_spacing(ppr, before=40, after=120, line=300, line_rule="auto")

    table_style = ensure_table_style(root, "Table", "Table")
    set_table_defaults(table_style)

    tree.write(styles_xml, encoding="utf-8", xml_declaration=True)


def configure_document(document_xml: Path) -> None:
    tree = ET.parse(document_xml)
    root = tree.getroot()
    body = root.find(w_tag("body"))
    if body is None:
        raise RuntimeError("word/document.xml does not contain w:body")

    sect_pr = body.find(w_tag("sectPr"))
    if sect_pr is None:
        sect_pr = ET.SubElement(body, w_tag("sectPr"))

    pg_sz = get_or_create(sect_pr, w_tag("pgSz"))
    pg_sz.set(w_attr("w"), "11906")
    pg_sz.set(w_attr("h"), "16838")

    pg_mar = get_or_create(sect_pr, w_tag("pgMar"))
    pg_mar.set(w_attr("top"), "1440")
    pg_mar.set(w_attr("right"), "1440")
    pg_mar.set(w_attr("bottom"), "1440")
    pg_mar.set(w_attr("left"), "1440")
    pg_mar.set(w_attr("header"), "720")
    pg_mar.set(w_attr("footer"), "720")
    pg_mar.set(w_attr("gutter"), "0")

    doc_grid = get_or_create(sect_pr, w_tag("docGrid"))
    doc_grid.set(w_attr("linePitch"), "360")

    tree.write(document_xml, encoding="utf-8", xml_declaration=True)


def rebuild_docx(docx_path: Path, source_dir: Path) -> None:
    temp_output = docx_path.with_suffix(".tmp.docx")
    with zipfile.ZipFile(temp_output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(source_dir.rglob("*")):
            if file_path.is_dir():
                continue
            archive.write(file_path, file_path.relative_to(source_dir).as_posix())
    temp_output.replace(docx_path)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: prepare_reference_docx.py <path-to-reference.docx>", file=sys.stderr)
        return 1

    docx_path = Path(sys.argv[1]).resolve()
    if not docx_path.is_file():
        print(f"reference docx not found: {docx_path}", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix="perfectmd-reference-docx-") as temp_dir:
        temp_root = Path(temp_dir)
        with zipfile.ZipFile(docx_path, "r") as archive:
            archive.extractall(temp_root)

        configure_styles(temp_root / "word" / "styles.xml")
        configure_document(temp_root / "word" / "document.xml")
        rebuild_docx(docx_path, temp_root)

    print(f"updated {docx_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
