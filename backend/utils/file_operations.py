import os
import shutil
from fastapi import UploadFile

async def save_upload_file(upload_file: UploadFile, destination_dir: str) -> str:
    """
    Saves an uploaded file to the specified directory.

    Args:
        upload_file: The FastAPI UploadFile object.
        destination_dir: The directory to save the file in.

    Returns:
        The full path to the saved file.

    Raises:
        IOError: If the file cannot be saved.
    """
    os.makedirs(destination_dir, exist_ok=True)
    file_location = os.path.join(destination_dir, upload_file.filename)
    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(upload_file.file, file_object)
        return file_location
    except Exception as e:
        # Log the error appropriately in a real application
        print(f"Error saving file {upload_file.filename}: {e}")
        raise IOError(f"Could not save file: {upload_file.filename}")
