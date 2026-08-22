import re

FENCE_RE = re.compile(r"```(?:java|Java|JAVA)?\s*\n?([\s\S]*?)```", re.MULTILINE)
HTML_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
HTML_ENTITY_MAP = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
}


def strip_code_fences(text: str) -> str:
    """
    Claude sometimes wraps code in ```java fences, or (rarely) echoes it back
    inside HTML tags picked up from a pasted slide/PDF. This guarantees the
    IDE screen only ever receives raw Java source.
    """
    if not text:
        return ""

    text = text.strip()

    # 1. If there's a fenced code block anywhere, extract the *contents* of
    #    the first one — this is almost always what we want, discarding any
    #    prose Claude added before/after.
    match = FENCE_RE.search(text)
    if match:
        text = match.group(1)

    # 2. Strip any leftover HTML tags (e.g. <pre>, <code>, <div> wrappers)
    #    while keeping their text content.
    text = HTML_TAG_RE.sub("", text)

    # 3. Decode common HTML entities that leak in from copy-pasted slide HTML.
    for entity, char in HTML_ENTITY_MAP.items():
        text = text.replace(entity, char)

    return text.strip()


def strip_markdown_prose(text: str) -> str:
    """Remove markdown bullets/asterisks/headers from any spoken-explanation text."""
    if not text:
        return ""
    text = re.sub(r"```[\s\S]*?```", " ", text)   # drop stray code blocks
    text = re.sub(r"[*_#>`]", "", text)            # strip markdown symbols
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)  # bullet markers
    text = re.sub(r"\s+", " ", text).strip()
    return text
