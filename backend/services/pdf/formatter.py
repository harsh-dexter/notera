# PDF formatting logic using fpdf2 supporting Unicode (e.g., Chinese)

import os
from fpdf import FPDF # Requires: pip install fpdf2
from datetime import datetime

# Define colors
BLUE = (41, 128, 185)
LIGHT_GRAY = (236, 240, 241)
DARK_GRAY = (52, 73, 94)

# Maximum length for items to prevent overflow
MAX_ITEM_LENGTH = 1000

# Define path to fonts directory (assuming it's sibling to 'services')
FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
CHINESE_FONT_PATH = os.path.join(FONT_DIR, 'NotoSansSC-Regular.ttf') # Simplified Chinese font

# Helper to replace common problematic characters for standard PDF fonts
def sanitize_text(text: str) -> str:
    """Replaces common Unicode characters with ASCII equivalents for basic PDF fonts."""
    replacements = {
        '’': "'",  # Right single quote
        '‘': "'",  # Left single quote
        '“': '"',  # Left double quote
        '”': '"',  # Right double quote
        '–': '-',  # En dash
        '—': '-',  # Em dash
        '…': '...', # Ellipsis
        # Add more replacements as needed
    }
    for unicode_char, ascii_char in replacements.items():
        text = text.replace(unicode_char, ascii_char)
    # FPDF's write() handles basic encoding, but we remove known issues first
    # Encode to latin-1, ignoring errors, then decode back. This removes most other unsupported chars.
    return text.encode('latin-1', 'ignore').decode('latin-1')

class PDFReport(FPDF):
    def __init__(self):
        super().__init__()
        self.meeting_title = "Meeting Report"
        self.date = datetime.now().strftime("%Y-%m-%d %H:%M")

        # Add Unicode font supporting Chinese
        # Ensure the font file exists at the specified path
        if os.path.exists(CHINESE_FONT_PATH):
            try: # Add try-except around add_font
                self.add_font('NotoSansSC', '', CHINESE_FONT_PATH, uni=True)
                self.font_family_unicode = 'NotoSansSC'
                print(f"Successfully added font: {CHINESE_FONT_PATH}")
            except Exception as font_error:
                print(f"!!! ERROR adding font {CHINESE_FONT_PATH}: {font_error}. Using fallback.")
                self.font_family_unicode = 'Helvetica' # Explicit fallback
        else:
            print(f"!!! WARNING: Font file not found at {CHINESE_FONT_PATH}. Using fallback font.")
            # Explicit fallback to a known built-in font
            self.font_family_unicode = 'Helvetica' # Explicit fallback

        # Ensure font_family_unicode is valid before setting
        if not self.font_family_unicode:
             print("!!! ERROR: font_family_unicode became empty. Defaulting to Helvetica.")
             self.font_family_unicode = 'Helvetica'

        # Set page margins (left, top, right) in mm
        self.set_margins(15, 15, 15)
        # Set auto page break to avoid content overflow
        self.set_auto_page_break(auto=True, margin=15)

        # Set default font to the Unicode one (or fallback)
        try: # Add try-except around set_font
            self.set_font(self.font_family_unicode, '', 11)
        except Exception as set_font_error:
            print(f"!!! ERROR setting default font to '{self.font_family_unicode}': {set_font_error}. Trying Helvetica.")
            self.font_family_unicode = 'Helvetica' # Final fallback attempt
            self.set_font(self.font_family_unicode, '', 11) # Try setting Helvetica

    def format_time(self, seconds: float) -> str:
        """Converts seconds to HH:MM:SS format."""
        try:
            total_seconds = int(seconds)
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            secs = total_seconds % 60
            return f"{hours:02}:{minutes:02}:{secs:02}"
        except (TypeError, ValueError):
            return "00:00:00" # Fallback for invalid input

    def header(self):
        # Save current position
        self.set_font(self.font_family_unicode, 'B', 12) # Use Unicode font
        # Set header color
        self.set_text_color(*BLUE)
        # Title
        self.cell(0, 10, self.meeting_title, 0, 1, 'C')
        # Line break
        self.ln(5)
        # Line separator
        self.set_draw_color(*BLUE)
        self.line(10, self.get_y(), self.w - 10, self.get_y())
        self.ln(5)

    def footer(self):
        # Go to 1.5 cm from bottom
        self.set_y(-15)
        # Set font
        self.set_font(self.font_family_unicode, 'I', 8) # Use Unicode font
        # Set text color to gray
        self.set_text_color(*DARK_GRAY)
        # Print page number
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

    def create_cover_page(self, job_id, filename):
        self.add_page()
        # Big title
        self.set_font(self.font_family_unicode, 'B', 24) # Use Unicode font
        self.set_text_color(*BLUE)
        self.cell(0, 20, 'Meeting Report', 0, 1, 'C')
        self.ln(10)

        # Meeting details
        self.set_font(self.font_family_unicode, '', 12) # Use Unicode font
        self.set_text_color(*DARK_GRAY)
        self.cell(0, 10, f"Date: {self.date}", 0, 1, 'C')
        self.cell(0, 10, f"File: {filename}", 0, 1, 'C') # Filename might have Unicode
        self.cell(0, 10, f"Job ID: {job_id}", 0, 1, 'C')

        # Add a visual element - line
        self.ln(10)
        self.set_draw_color(*BLUE)
        self.line(40, self.get_y(), self.w - 40, self.get_y())

        # Note
        self.ln(20)
        self.set_font(self.font_family_unicode, 'I', 12) # Use Unicode font
        self.cell(0, 10, "AI-Generated Meeting Notes", 0, 1, 'C')

    def chapter_title(self, title):
        self.set_font(self.font_family_unicode, 'B', 14) # Use Unicode font
        self.set_text_color(*BLUE)
        # Add a background rectangle
        self.set_fill_color(*LIGHT_GRAY)
        self.cell(0, 10, title, 0, 1, 'L', True)
        self.ln(4)

    def chapter_body(self, body):
        self.set_font(self.font_family_unicode, '', 11) # Use Unicode font
        self.set_text_color(*DARK_GRAY)

        # Truncate extremely long text to prevent rendering issues
        if len(body) > MAX_ITEM_LENGTH:
            body = body[:MAX_ITEM_LENGTH] + "... [text truncated due to length]"

        # Sanitize text before writing
        sanitized_body = sanitize_text(body)

        # Use multi_cell directly with sanitized text
        self.multi_cell(0, 6, sanitized_body)
        self.ln()

    def list_items(self, items: list, title: str):
        if items:
            self.chapter_title(title)
            self.set_font(self.font_family_unicode, '', 11) # Use Unicode font
            self.set_text_color(*DARK_GRAY)
            for i, item in enumerate(items, 1):
                # No need for try/except for encoding anymore
                    # Truncate long items
                    item_str = str(item)
                    if len(item_str) > MAX_ITEM_LENGTH:
                        item_str = item_str[:MAX_ITEM_LENGTH] + "... [truncated]"

                    item_str = str(item) # Ensure item is a string
                    if len(item_str) > MAX_ITEM_LENGTH:
                        item_str = item_str[:MAX_ITEM_LENGTH] + "... [truncated]"

                    # Sanitize the item string
                    sanitized_item_str = sanitize_text(item_str)

                    # Add bullet point with proper indentation
                    self.cell(10, 6, f"{i}.", 0, 0)
                    # Calculate remaining width for the item text
                    remaining_width = self.w - self.l_margin - self.r_margin - 10
                    # Use multi_cell for the item text with the correct width
                    self.multi_cell(remaining_width, 6, sanitized_item_str) # Use sanitized string
                    self.ln(2)  # Add a small space between items
            self.ln()
