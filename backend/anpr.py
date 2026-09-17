import threading
import queue
import time
import cv2
import numpy as np

# Try to import easyocr, but allow fallback if not installed yet
OCR_AVAILABLE = False
try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    pass


# ---------------------------------------------------------------------------
# Plate validation — module-level so it can be imported anywhere in the
# backend without creating a circular dependency.
# ---------------------------------------------------------------------------

# Placeholder strings that must NEVER be stored as a vehicle registration number.
_INVALID_PLATE_VALUES = {
    "SCANNING...", "SCANNING", "UNKNOWN", "N/A", "NOT DETECTED", "NOTDETECTED",
    "READING...", "READING", "PENDING...", "PENDING", "PROCESSING...", "PROCESSING",
    "NONE", "NULL", "NA", ""
}


def is_valid_plate(plate_text) -> bool:
    """
    Returns True only when plate_text represents a real, usable license-plate
    registration number.

    Rejects:
      - None / non-string values
      - Empty or whitespace-only strings
      - Known placeholder strings ("Scanning...", "Unknown", "N/A", etc.)
      - Strings shorter than 4 alphanumeric characters after stripping

    This is the single gate that prevents "Scanning..." and similar garbage
    values from ever reaching the vehicle database.
    """
    if plate_text is None:
        return False
    if not isinstance(plate_text, str):
        return False

    stripped = plate_text.strip()
    if not stripped:
        return False

    # Check against known bad values (case-insensitive, spaces removed)
    normalised = ''.join(stripped.upper().split())
    if normalised in _INVALID_PLATE_VALUES:
        return False

    # Must contain at least 4 alphanumeric characters
    alnum_chars = [c for c in stripped if c.isalnum()]
    if len(alnum_chars) < 4:
        return False

    return True


class ANPRModule:
    """
    Asynchronous Number Plate Recognition Module.
    Uses EasyOCR in a background thread to avoid blocking the main tracking loop.
    """
    def __init__(self, callback=None):
        self.queue = queue.Queue()
        self.is_running = False
        self.reader = None
        self.callback = callback  # Function to call when plate is detected
        self.thread = None

    def start(self):
        if self.is_running:
            return

        self.is_running = True
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.is_running = False
        # Put a sentinel to unblock queue
        self.queue.put(None)
        if self.thread:
            self.thread.join(timeout=2.0)

    def enqueue_crop(self, tracking_id: int, crop: np.ndarray):
        """Add a vehicle image crop to the queue for OCR processing."""
        if self.is_running:
            # Only keep a small queue to avoid processing stale frames
            if self.queue.qsize() < 10:
                self.queue.put((tracking_id, crop.copy()))

    def _worker_loop(self):
        print("[ANPR] Worker thread started.")

        if OCR_AVAILABLE:
            try:
                print("[ANPR] Loading EasyOCR model...")
                # Initialize EasyOCR reader (enables english, gpu=False for max compatibility)
                self.reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                print("[ANPR] EasyOCR model loaded successfully.")
            except Exception as e:
                print(f"[ANPR] Failed to load EasyOCR: {e}")
                self.reader = None
        else:
            print("[ANPR] EasyOCR not installed. Plate detection will be simulated.")

        while self.is_running:
            try:
                item = self.queue.get(timeout=1.0)
                if item is None:
                    break

                tracking_id, crop = item
                plate_text = self._detect_plate(crop)

                # GATE: Only call the callback with a genuinely valid plate.
                # is_valid_plate() is the single source of truth — it rejects None,
                # empty strings, placeholder values and too-short results.
                # An unidentified vehicle MUST NOT trigger the callback.
                if is_valid_plate(plate_text) and self.callback:
                    self.callback(tracking_id, plate_text)

                self.queue.task_done()

            except queue.Empty:
                continue
            except Exception as e:
                print(f"[ANPR] Worker error: {e}")

    def _detect_plate(self, crop: np.ndarray) -> str:
        """Runs OCR on the given crop. Returns a raw text string or None."""
        if not OCR_AVAILABLE or self.reader is None:
            # Simulate a delay and a fake plate for testing purposes
            time.sleep(0.5)
            # Return a mock plate ~30% of the time to simulate real OCR variability
            if np.random.random() > 0.7:
                return f"KA{np.random.randint(10, 99)}AB{np.random.randint(1000, 9999)}"
            return None

        try:
            # Preprocess: convert to grayscale for better OCR accuracy
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

            # Read text with EasyOCR
            results = self.reader.readtext(gray)

            best_text = None
            best_conf = 0.0

            for (bbox, text, prob) in results:
                # Basic cleanup: remove spaces and non-alphanumeric chars
                clean_text = ''.join(e for e in text if e.isalnum()).upper()

                # Heuristic: Indian plates are typically 9-10 chars (e.g., KA01AB1234)
                # Accept any text >= 5 chars with confidence > 0.3
                if len(clean_text) >= 5 and prob > best_conf and prob > 0.3:
                    best_text = clean_text
                    best_conf = prob

            return best_text

        except Exception as e:
            print(f"[ANPR] Detection error: {e}")
            return None
