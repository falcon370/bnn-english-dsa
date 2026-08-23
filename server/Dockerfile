FROM node:22-slim

RUN ln -sf /usr/local/bin/node /usr/bin/node || true

# Install Python 3, pip, venv, and build-essential for compiling python extensions
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node backend dependencies
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy Node backend code
COPY server/ .

# Set up Sentiment Analysis directory and install requirements
COPY sentiment_analysis2/requirements.txt /sentiment_analysis2/requirements.txt
RUN python3 -m venv /sentiment_analysis2/venv_new \
    && /sentiment_analysis2/venv_new/bin/pip install --upgrade pip \
    && /sentiment_analysis2/venv_new/bin/pip install -r /sentiment_analysis2/requirements.txt \
    && /sentiment_analysis2/venv_new/bin/python -m spacy download en_core_web_sm

# Copy the rest of the sentiment analyzer files
COPY sentiment_analysis2 /sentiment_analysis2

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/index.js"]
