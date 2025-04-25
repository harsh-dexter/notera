# Text summarization and extraction logic using LangChain
# Requires: pip install langchain langchain-community ollama
# Or: pip install langchain langchain-openai (for OpenAI)

import asyncio
import os
import re
from typing import Dict, Any, List
from langchain_core.prompts import PromptTemplate
# LLMChain is deprecated, we'll use LCEL (prompt | llm)
from langchain_core.output_parsers import BaseOutputParser
from langchain_core.runnables import RunnableSequence


LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
# Supported providers: "ollama"
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "deepseek-r1:1.5b")
# Ollama base URL (if not default localhost:11434)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")



def load_llm():
    """Loads the configured LLM provider."""
    print(f"Loading LLM provider: {LLM_PROVIDER}, model: {LLM_MODEL_NAME}")
    if LLM_PROVIDER == "ollama":
        try:
            # Use the updated OllamaLLM class
            from langchain_ollama import OllamaLLM
            return OllamaLLM(model=LLM_MODEL_NAME, base_url=OLLAMA_BASE_URL)
        except ImportError:
            raise ImportError("Ollama provider selected, but 'langchain-ollama' is not installed. Run: pip install -U langchain-ollama")
        except Exception as e:
            raise RuntimeError(f"Failed to connect to Ollama at {OLLAMA_BASE_URL}. Is Ollama running? Error: {e}")
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")

# Load LLM globally (similar considerations as ASR model)
_llm = None
try:
    _llm = load_llm()
    print("LLM loaded successfully.")
except Exception as e:
    print(f"Error loading LLM: {e}")
    # Application might fail if LLM is essential


class BulletPointOutputParser(BaseOutputParser[List[str]]):
    """Parses LLM output assumed to be a bulleted list."""
    def parse(self, text: str) -> List[str]:
        lines = text.strip().split('\n')
        # Match lines starting with common bullet points, strip them and surrounding whitespace
        items = [re.sub(r"^\s*[-*+•]\s*", "", line).strip() for line in lines if re.match(r"^\s*[-*+•]", line)]
        # Filter out empty strings that might result
        return [item for item in items if item]


SUMMARY_TEMPLATE = """
You are an expert meeting summarizer tasked with creating a concise, neutral overview.
Your summary should:
1. Start with the main purpose or outcome of the meeting.
2. Briefly list the 2-4 most important topics discussed.
3. Mention any key conclusions or agreements reached.
4. Be written in clear, professional language.
5. Avoid personal opinions, speculation, or excessive detail.
6. Focus solely on information present in the transcript.

TRANSCRIPT:
{transcript}

CONCISE SUMMARY:"""
SUMMARY_PROMPT = PromptTemplate(template=SUMMARY_TEMPLATE, input_variables=["transcript"])

ACTION_ITEMS_TEMPLATE = """
Analyze the following meeting transcript. Extract only the clear, specific, and actionable tasks assigned during the meeting.
- List each action item as a separate bullet point (using '- ').
- If possible, include who is responsible for the action item. Format as: "- [Action Description] (Owner: [Name/Group])"
- Do not include general discussion, suggestions, or items already completed.
- If no specific action items were assigned, respond ONLY with the text "No action items identified.".

TRANSCRIPT:
{transcript}

ACTION ITEMS:
"""
ACTION_ITEMS_PROMPT = PromptTemplate(template=ACTION_ITEMS_TEMPLATE, input_variables=["transcript"])

DECISIONS_TEMPLATE = """
Review the following meeting transcript. Identify and extract only the explicit decisions, agreements, or resolutions made by the participants.
- List each decision as a separate bullet point (using '- ').
- Focus on final outcomes, not the discussion leading up to them.
- Do not include proposals that were not agreed upon or general statements.
- If no explicit decisions were made, respond ONLY with the text "No decisions identified.".

TRANSCRIPT:
{transcript}

DECISIONS MADE:
"""
DECISIONS_PROMPT = PromptTemplate(template=DECISIONS_TEMPLATE, input_variables=["transcript"])


summary_chain: RunnableSequence | None = None
action_items_chain: RunnableSequence | None = None
decisions_chain: RunnableSequence | None = None

if _llm:
    # Define chains using the LangChain Expression Language (LCEL)
    summary_chain = SUMMARY_PROMPT | _llm
    action_items_chain = ACTION_ITEMS_PROMPT | _llm | BulletPointOutputParser()
    decisions_chain = DECISIONS_PROMPT | _llm | BulletPointOutputParser()
else:
    print("Warning: LLM not loaded. Summarization features will be disabled.")


async def process_transcript(transcript: str) -> Dict[str, Any]:
    """
    Generates a summary, extracts action items, and decisions from the transcript
    using the configured LangChain setup.

    Args:
        transcript: The full text transcript.

    Returns:
        A dictionary containing:
        - summary: A concise summary of the meeting.
        - action_items: A list of extracted action items.
        - decisions: A list of extracted decisions.
    """
    if not _llm or not summary_chain or not action_items_chain or not decisions_chain:
        if not _llm:print("Warning: No LLM loaded. Ensure the LLM provider and model are correctly set in the environment variables.")

        return {
            "summary": "LLM processing disabled.",
            "action_items": [],
            "decisions": []
        }

    print(f"Starting transcript processing using LLM: {LLM_PROVIDER} ({LLM_MODEL_NAME})...")
    summary = "Summary generation failed."
    action_items = []
    decisions = []

    try:
        # Run chains concurrently using LCEL's ainvoke
        # Input is now just the dictionary for the prompt variables
        results = await asyncio.gather(
            summary_chain.ainvoke({"transcript": transcript}),
            action_items_chain.ainvoke({"transcript": transcript}),
            decisions_chain.ainvoke({"transcript": transcript}),
            return_exceptions=True # Allow tasks to fail without stopping others
        )

        # Process results, checking for exceptions
        summary_result, action_items_result, decisions_result = results


        print(f"Raw Action Items LLM Output: {action_items_result}")
        print(f"Raw Decisions LLM Output: {decisions_result}")

        if isinstance(summary_result, Exception):
            print(f"Error generating summary: {summary_result}")
            summary = f"Error: {summary_result}"
        elif isinstance(summary_result, str):
             # LCEL chain directly returns the string output
             # Remove <think> tags potentially added by the model
             cleaned_summary = re.sub(r"<think>.*?</think>\s*", "", summary_result, flags=re.DOTALL)
             summary = cleaned_summary.strip()
        else:
            summary = "Summary generation produced unexpected output type."


        if isinstance(action_items_result, Exception):
            print(f"Error extracting action items: {action_items_result}")
            action_items = [f"Error: {action_items_result}"]
        elif isinstance(action_items_result, list):
             # LCEL chain with parser returns the parsed list
            action_items = action_items_result
        else:
             action_items = ["Action items extraction produced unexpected output type."]


        if isinstance(decisions_result, Exception):
            print(f"Error extracting decisions: {decisions_result}")
            decisions = [f"Error: {decisions_result}"]
        elif isinstance(decisions_result, list):
            # LCEL chain with parser returns the parsed list
            decisions = decisions_result
        else:
            decisions = ["Decisions extraction produced unexpected output type."]

        print("Transcript processing complete.")

    except Exception as e:
        print(f"Unexpected error during transcript processing: {e}")
        # Update results to indicate a general failure
        summary = f"General processing error: {e}"
        action_items = []
        decisions = []

    return {
        "summary": summary,
        "action_items": action_items,
        "decisions": decisions
    }
