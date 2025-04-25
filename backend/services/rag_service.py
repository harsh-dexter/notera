# rag_service.py

import os
import asyncio
import re # Import re module
import chromadb
from chromadb.config import Settings

from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI


VECTOR_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "vector_db")
USE_HTTP_MODE = os.getenv("CHROMA_USE_HTTP", "false").lower() == "true"
CHROMA_SERVER_HOST = os.getenv("CHROMA_SERVER_HOST", "localhost")
CHROMA_SERVER_PORT = int(os.getenv("CHROMA_SERVER_PORT", "8000"))

embedding_function = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
os.makedirs(VECTOR_DB_PATH, exist_ok=True)

# Initialize ChromaDB client
try:
    if USE_HTTP_MODE:
        print(f"Initializing ChromaDB in HTTP mode at {CHROMA_SERVER_HOST}:{CHROMA_SERVER_PORT}")
        client = chromadb.HttpClient(host=CHROMA_SERVER_HOST, port=CHROMA_SERVER_PORT)
    else:
        print(f"Initializing ChromaDB in local persistent mode at: {VECTOR_DB_PATH}")
        client = chromadb.PersistentClient(path=VECTOR_DB_PATH)
    print("ChromaDB client initialized successfully.")
except Exception as e:
    print(f"Error initializing ChromaDB client: {e}")
    print("Using fallback in-memory client.")
    client = chromadb.Client()

# LLM Initialization
try:
    from langchain_community.chat_models import ChatOllama
    llm = ChatOllama(model="deepseek-r1:1.5b")
except Exception as e:
    print(f"⚠️ Ollama not available: {e}")
    if os.getenv("OPENAI_API_KEY"):
        llm = ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0)
    else:
        print("❌ No LLM configured. RAG will not work.")
        llm = None


classification_prompt = PromptTemplate.from_template("""
Classify the user's input. Respond with only one of the following labels:
- "small_talk": for casual or social conversation (e.g., greetings, chitchat)
- "rag": if the question needs context from a transcript to answer
- "other": if it's something else (e.g., meta-questions, feedback)

Input: {query}
Label:
""")

async def classify_query(query: str) -> str:
    chain = classification_prompt | llm | StrOutputParser()
    try:
        label = await chain.ainvoke(query)
        return label.strip().lower()
    except Exception as e:
        print(f"⚠️ Classification failed: {e}")
        return "rag"

def get_small_talk_response(query: str) -> str:
    if "hi" in query.lower():
        return "Hello! How can I assist you today?"
    elif "how are you" in query.lower():
        return "I'm just a bunch of code, but happy to help!"
    elif "thanks" in query.lower():
        return "You're welcome!"
    elif "bye" in query.lower():
        return "Goodbye! Have a great day."
    else:
        return "Nice to chat! What else can I help you with?"


def get_vector_store_for_meeting(meeting_id: str) -> Chroma:
    collection_name = f"meeting_{meeting_id.replace('-', '_')}"
    return Chroma(
        client=client,
        collection_name=collection_name,
        embedding_function=embedding_function
    )

async def add_transcript_to_store(meeting_id: str, transcript_segments: list[dict]):
    print(f"📥 Adding transcript for meeting {meeting_id} to vector store...")

    if not transcript_segments:
        print("⚠️ No transcript segments to add.")
        return

    full_text = "\n".join([
        f"Speaker {s.get('speakerId', 'Unknown')} ({s.get('startTime', 0):.2f}s): {s.get('text', '')}"
        for s in transcript_segments
    ])

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(full_text)
    documents = [Document(page_content=chunk, metadata={"meeting_id": meeting_id}) for chunk in chunks]

    if not documents:
        print("⚠️ No documents created after splitting.")
        return

    vector_store = get_vector_store_for_meeting(meeting_id)

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, vector_store.add_documents, documents)
        print(f"✅ Successfully added {len(documents)} chunks to vector store.")
    except Exception as e:
        print(f"❌ Error adding documents: {e}")


async def query_transcript(meeting_id: str, query: str) -> str:
    if not llm:
        return "LLM not available. Please check configuration."

    print(f"🔍 Querying transcript for meeting {meeting_id}: '{query}'")

    try:
        query_type = await classify_query(query)

        if query_type == "small_talk":
            return get_small_talk_response(query)

        # If it's not small talk, assume it's a RAG query.
        # This handles cases previously classified as "other" or potential classification errors.
        print(f"Treating query as RAG (original classification: '{query_type}')") # Added logging

        vector_store = get_vector_store_for_meeting(meeting_id)
        retriever = vector_store.as_retriever(search_kwargs={'k': 3})

        prompt_template = """You are a helpful assistant. Answer the question based primarily on the provided context.
Try to infer the answer from the context if it's not explicitly stated.
Do not include any disclaimers or unnecessary information in your response and avoid using <think> tags.
If the context doesn't provide any clues to answer the question, state that the transcript doesn't contain that information.

Context:
{context}

Question: {question}

Answer:"""
        prompt = ChatPromptTemplate.from_template(prompt_template)

        rag_chain = (
            {"context": retriever, "question": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )

        raw_answer = await rag_chain.ainvoke(query)
        print(f"💬 Raw Answer: {raw_answer}") # Log raw answer for debugging

        # Clean the answer: remove <think> tags and "Answer:" prefix
        cleaned_answer = re.sub(r"<think>.*?</think>\s*", "", raw_answer, flags=re.DOTALL)
        cleaned_answer = cleaned_answer.strip()
        if cleaned_answer.lower().startswith("answer:"):
            cleaned_answer = cleaned_answer[len("answer:"):].strip()

        print(f"✅ Cleaned Answer: {cleaned_answer}")
        return cleaned_answer

    except Exception as e:
        print(f"❌ Error during RAG query: {e}")
        return "Sorry, I encountered an error while answering your question."
