# MarkItDown (https://github.com/microsoft/markitdown, MIT): converts Office files, PDF and similar to Markdown.
# Built from the released package on PyPI, pinned to one version so that a build today and a build next month give the same tool.
# Only the converters the eQMS needs are installed (Word, PowerPoint, Excel, PDF, Outlook); audio, YouTube and the Azure Document
# Intelligence converters are left out so that the image stays small and has less to attack.
ARG PYTHON_IMAGE=mirror.gcr.io/library/python:3.12-slim
FROM ${PYTHON_IMAGE}

ARG MARKITDOWN_VERSION=0.1.8
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install "markitdown[docx,pptx,xlsx,xls,pdf,outlook]==${MARKITDOWN_VERSION}" \
 && useradd --uid 10001 --create-home --shell /usr/sbin/nologin markitdown \
 && mkdir /workdir && chown markitdown /workdir

# Files to convert are mounted here; the converted Markdown is written next to them.
WORKDIR /workdir
USER 10001
ENTRYPOINT ["markitdown"]
