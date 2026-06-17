import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> Optional[str]:
    try:
        import fitz
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for i in range(len(doc)):
            text = doc[i].get_text("text").strip()
            if text:
                pages.append(f"[Page {i + 1}]\n{text}")
        doc.close()

        if not pages:
            logger.warning("PDF had no extractable text (may be scanned)")
            return None

        full = "\n\n".join(pages)
        full = re.sub(r"\n{3,}", "\n\n", full)
        full = re.sub(r"[ \t]+", " ", full)
        logger.info(f"PDF: {len(full)} chars from {len(pages)} pages")
        return full

    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise ValueError(f"Could not parse PDF: {e}")
