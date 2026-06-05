from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUNDLED_SOFFICE = Path(
    "/Users/mauriciogarcia/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/soffice"
)


@dataclass(frozen=True)
class Paper:
    slug: str
    title: str
    role: str
    source: Path


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def find_soffice() -> Path:
    candidates = [
        Path(value)
        for value in [
            os.environ.get("SOFFICE"),
            str(BUNDLED_SOFFICE) if BUNDLED_SOFFICE.exists() else None,
            shutil.which("soffice"),
            shutil.which("libreoffice"),
        ]
        if value
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("LibreOffice not found. Set SOFFICE=/path/to/soffice and rerun.")


def copy_public_pdf(source: Path, destination_name: str) -> None:
    public_dir = ROOT / "site" / "public" / "papers"
    public_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, public_dir / destination_name)


def copy_public_source(paper: Paper, out_dir: Path, tex_path: Path) -> None:
    public_dir = ROOT / "site" / "public" / "papers" / paper.slug
    if public_dir.exists():
        shutil.rmtree(public_dir)
    public_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(tex_path, public_dir / tex_path.name)
    media_dir = out_dir / "media"
    if media_dir.exists():
        shutil.copytree(media_dir, public_dir / "media")


def convert_to_latex(paper: Paper, out_dir: Path) -> Path:
    tex_path = out_dir / f"{paper.slug}.tex"
    media_dir = out_dir / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    run(
        [
            "pandoc",
            str(paper.source),
            "--from",
            "docx",
            "--to",
            "latex",
            "--standalone",
            "--extract-media",
            str(media_dir),
            "--metadata",
            f"title={paper.title}",
            "--output",
            str(tex_path),
        ]
    )
    text = tex_path.read_text(encoding="utf-8")
    text = text.replace(f"{media_dir.as_posix()}/", "media/")
    tex_path.write_text(text, encoding="utf-8")
    return tex_path


def convert_to_pdf(paper: Paper, out_dir: Path) -> Path:
    soffice = find_soffice()
    with tempfile.TemporaryDirectory(prefix="liarsdice-soffice-") as profile:
        run(
            [
                str(soffice),
                "--headless",
                f"-env:UserInstallation=file://{profile}",
                "--convert-to",
                "pdf",
                "--outdir",
                str(out_dir),
                str(paper.source),
            ]
        )
    generated = out_dir / f"{paper.source.stem}.pdf"
    final_pdf = out_dir / f"{paper.slug}.pdf"
    if generated != final_pdf:
        generated.replace(final_pdf)
    return final_pdf


def write_index(papers: list[Paper]) -> None:
    archive_dir = ROOT / "docs" / "archive"
    public_dir = ROOT / "site" / "public" / "papers"
    index = [
        {
            "slug": paper.slug,
            "title": paper.title,
            "role": paper.role,
            "pdf": f"{paper.slug}.pdf",
            "latex": f"{paper.slug}/{paper.slug}.tex",
        }
        for paper in papers
    ]
    (archive_dir / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    public_dir.mkdir(parents=True, exist_ok=True)
    (public_dir / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")


def build_archive(papers: list[Paper]) -> None:
    archive_dir = ROOT / "docs" / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    for paper in papers:
        if not paper.source.exists():
            raise FileNotFoundError(f"Missing source DOCX: {paper.source}")
        out_dir = archive_dir / paper.slug
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        tex_path = convert_to_latex(paper, out_dir)
        pdf_path = convert_to_pdf(paper, out_dir)
        copy_public_pdf(pdf_path, f"{paper.slug}.pdf")
        copy_public_source(paper, out_dir, tex_path)
    write_index(papers)


def build_parser() -> argparse.ArgumentParser:
    downloads = Path.home() / "Downloads"
    parser = argparse.ArgumentParser(description="Build the curated DOCX to LaTeX/PDF paper archive")
    parser.add_argument("--final-docx", type=Path, default=downloads / "Final Report.docx")
    parser.add_argument("--applied-docx", type=Path, default=downloads / "Applied Focus - 1st Deliverable.docx")
    parser.add_argument(
        "--notes-docx",
        type=Path,
        default=downloads / "CS370_ Multiagent Learning & Computational Game Solving Notes & Planning.docx",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    papers = [
        Paper(
            slug="final-report",
            title="Multi-Agent Learning and Imperfect Information Games: Final Report",
            role="Primary final report",
            source=args.final_docx,
        ),
        Paper(
            slug="applied-focus",
            title="Applied Multi-Agent Learning and Imperfect Information Games",
            role="Supporting applied-focus deliverable",
            source=args.applied_docx,
        ),
        Paper(
            slug="research-notebook",
            title="CS370 Multiagent Learning and Computational Game Solving Notes and Planning",
            role="Research notebook and planning archive",
            source=args.notes_docx,
        ),
    ]
    build_archive(papers)


if __name__ == "__main__":
    main()
