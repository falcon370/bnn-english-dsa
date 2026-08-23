import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "4000"))
EMBEDDING_DIMENSIONS = 384

model: SentenceTransformer | None = None


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1)


class EmbedResponse(BaseModel):
    embedding: List[float]


class BatchEmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=128)


class BatchEmbedResponse(BaseModel):
    embeddings: List[List[float]]


def clean_text(text: str) -> str:
    return " ".join(text.strip().split())[:MAX_TEXT_LENGTH]


def encode_texts(texts: List[str]) -> List[List[float]]:
    if model is None:
        raise RuntimeError("Embedding model is not loaded")

    cleaned = [clean_text(text) for text in texts]
    if any(not text for text in cleaned):
        raise HTTPException(status_code=400, detail="Text must not be empty")

    embeddings = model.encode(
        cleaned,
        batch_size=min(len(cleaned), int(os.getenv("INFERENCE_BATCH_SIZE", "32"))),
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    vectors = embeddings.tolist()
    for vector in vectors:
        if len(vector) != EMBEDDING_DIMENSIONS:
            raise RuntimeError(f"Expected {EMBEDDING_DIMENSIONS} dimensions, received {len(vector)}")

    return vectors


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global model
    model = SentenceTransformer(MODEL_NAME, device="cpu")
    yield
    model = None


app = FastAPI(
    title="BNN Image Embedding Service",
    version="1.0.0",
    description="CPU-only MiniLM embedding service for image metadata semantic search.",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dimensions": EMBEDDING_DIMENSIONS,
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    embedding = encode_texts([request.text])[0]
    return EmbedResponse(embedding=embedding)


@app.post("/embed/batch", response_model=BatchEmbedResponse)
def embed_batch(request: BatchEmbedRequest):
    embeddings = encode_texts(request.texts)
    return BatchEmbedResponse(embeddings=embeddings)
